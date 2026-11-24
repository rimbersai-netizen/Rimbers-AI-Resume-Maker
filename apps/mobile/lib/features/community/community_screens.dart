import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';
import '../../core/jobs_api.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../home/shell.dart' show ago;

const kindLabels = {'win': 'Win', 'question': 'Question', 'discussion': 'Discussion', 'roast': 'Feedback'};
const _filters = <String?, String>{null: 'All', 'win': 'Wins', 'question': 'Questions', 'roast': 'Feedback', 'discussion': 'Discussion'};

final postsProvider = FutureProvider.autoDispose.family<List<Post>, String?>((ref, kind) => Api.instance.posts(kind: kind));

class CommunityTab extends ConsumerStatefulWidget {
  const CommunityTab({super.key});
  @override
  ConsumerState<CommunityTab> createState() => _CommunityTabState();
}

class _CommunityTabState extends ConsumerState<CommunityTab> {
  String? _kind;
  @override
  Widget build(BuildContext context) {
    final posts = ref.watch(postsProvider(_kind));
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(Tokens.gutter, Tokens.gutter, Tokens.gutter, 0),
        child: Row(children: [
          Expanded(child: Text('Community', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800))),
          IconButton.filled(tooltip: 'New post', style: IconButton.styleFrom(backgroundColor: Tokens.brand), icon: const Icon(Icons.add), onPressed: () => context.push('/community/new').then((_) => ref.invalidate(postsProvider))),
        ]),
      ),
      const Padding(padding: EdgeInsets.fromLTRB(Tokens.gutter, 4, Tokens.gutter, 0), child: Align(alignment: Alignment.centerLeft, child: Text('Share wins, ask questions, get feedback. You appear under an anonymous name.', style: TextStyle(color: Tokens.textSecondary, fontSize: 12.5)))),
      SizedBox(
        height: 52,
        child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: Tokens.gutter, vertical: 8), children: [
          for (final e in _filters.entries)
            Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(label: Text(e.value), selected: _kind == e.key, onSelected: (_) => setState(() => _kind = e.key), selectedColor: Tokens.brand, labelStyle: TextStyle(color: _kind == e.key ? Colors.white : Tokens.textPrimary))),
        ]),
      ),
      Expanded(
        child: posts.when(
          loading: () => const Loading(),
          error: (e, _) => Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(e is ApiException ? e.message : 'Could not load the community.', onRetry: () => ref.invalidate(postsProvider))),
          data: (list) => list.isEmpty
              ? EmptyState(icon: Icons.forum_outlined, title: 'Nothing here yet', body: 'Be the first to post.', action: GradientButton(label: 'New post', onPressed: () => context.push('/community/new').then((_) => ref.invalidate(postsProvider))))
              : RefreshIndicator(
                  onRefresh: () async => ref.invalidate(postsProvider),
                  child: ListView.separated(padding: const EdgeInsets.all(Tokens.gutter), itemCount: list.length, separatorBuilder: (_, __) => const SizedBox(height: 10), itemBuilder: (_, i) => _PostCard(list[i])),
                ),
        ),
      ),
    ]);
  }
}

class _PostCard extends ConsumerStatefulWidget {
  final Post p;
  const _PostCard(this.p);
  @override
  ConsumerState<_PostCard> createState() => _PostCardState();
}

class _PostCardState extends ConsumerState<_PostCard> {
  Future<void> _like() async {
    final p = widget.p;
    setState(() { p.liked = !p.liked; p.likes += p.liked ? 1 : -1; });
    try {
      await Api.instance.toggleLike(p.id);
    } on ApiException catch (e) {
      if (mounted) { setState(() { p.liked = !p.liked; p.likes += p.liked ? 1 : -1; }); toast(context, e.message); }
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.p;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(Tokens.rCard),
        onTap: () => context.push('/community/${p.id}').then((_) => ref.invalidate(postsProvider)),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), decoration: BoxDecoration(color: Tokens.subtle, borderRadius: BorderRadius.circular(99)), child: Text(kindLabels[p.kind] ?? p.kind, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700))),
              const SizedBox(width: 8),
              Expanded(child: Text('${p.handle} · ${ago(p.createdAt)}', style: const TextStyle(color: Tokens.textSecondary, fontSize: 12), overflow: TextOverflow.ellipsis)),
            ]),
            const SizedBox(height: 8),
            Text(p.title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text(p.body, maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Tokens.textSecondary, height: 1.35)),
            const SizedBox(height: 8),
            Row(children: [
              TextButton.icon(onPressed: _like, icon: Icon(p.liked ? Icons.thumb_up : Icons.thumb_up_outlined, size: 18), label: Text('${p.likes}')),
              TextButton.icon(onPressed: () => context.push('/community/${p.id}').then((_) => ref.invalidate(postsProvider)), icon: const Icon(Icons.chat_bubble_outline, size: 18), label: Text('${p.comments}')),
            ]),
          ]),
        ),
      ),
    );
  }
}

class NewPostScreen extends StatefulWidget {
  const NewPostScreen({super.key});
  @override
  State<NewPostScreen> createState() => _NewPostScreenState();
}

class _NewPostScreenState extends State<NewPostScreen> {
  final _title = TextEditingController(), _body = TextEditingController();
  String _kind = 'discussion';
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    super.dispose();
  }

  Future<void> _post() async {
    setState(() { _busy = true; _error = null; });
    try {
      await Api.instance.createPost(_kind, _title.text, _body.text);
      if (mounted) context.pop();
    } on ApiException catch (e) {
      if (mounted) setState(() { _busy = false; _error = e.message; });
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('New post')),
        body: ListView(padding: const EdgeInsets.all(Tokens.gutter), children: [
          DropdownButtonFormField<String>(value: _kind, decoration: const InputDecoration(labelText: 'Type'), items: [for (final e in kindLabels.entries) DropdownMenuItem(value: e.key, child: Text(e.value))], onChanged: (v) => setState(() => _kind = v ?? _kind)),
          const SizedBox(height: 14),
          TextField(controller: _title, maxLength: 140, decoration: const InputDecoration(labelText: 'Title')),
          const SizedBox(height: 6),
          TextField(controller: _body, maxLength: 4000, minLines: 6, maxLines: 12, decoration: const InputDecoration(labelText: 'What’s on your mind?', alignLabelWithHint: true)),
          const Text('Do not include links, emails or phone numbers. Posts are public to all members, under an anonymous name.', style: TextStyle(color: Tokens.textSecondary, fontSize: 12.5)),
          const SizedBox(height: 12),
          if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 10), child: ErrorBanner(_error!)),
          GradientButton(label: 'Post', busy: _busy, onPressed: _post),
        ]),
      );
}

class PostScreen extends StatefulWidget {
  final String id;
  const PostScreen({super.key, required this.id});
  @override
  State<PostScreen> createState() => _PostScreenState();
}

class _PostScreenState extends State<PostScreen> {
  Post? _post;
  List<Comment> _comments = [];
  String? _error;
  bool _loading = true, _sending = false;
  final _reply = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _reply.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final r = await Api.instance.postThread(widget.id);
      _post = r.post;
      _comments = r.comments;
    } on ApiException catch (e) {
      _error = e.status == 404 ? 'This post is no longer available.' : e.message;
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _send() async {
    if (_reply.text.trim().isEmpty) return;
    setState(() => _sending = true);
    try {
      final c = await Api.instance.addComment(widget.id, _reply.text);
      _comments = [..._comments, c];
      _reply.clear();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message);
    }
    if (mounted) setState(() => _sending = false);
  }

  Future<void> _report({String? postId, String? commentId}) async {
    final c = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (d) => AlertDialog(
        title: const Text('Report'),
        content: TextField(controller: c, maxLength: 500, decoration: const InputDecoration(hintText: 'What is wrong with this?')),
        actions: [TextButton(onPressed: () => Navigator.pop(d), child: const Text('Cancel')), TextButton(onPressed: () => Navigator.pop(d, c.text), child: const Text('Send'))],
      ),
    );
    if (reason == null || reason.trim().length < 3) return;
    try {
      await Api.instance.reportContent(postId: postId, commentId: commentId, reason: reason);
      if (mounted) toast(context, 'Thanks — we’ll review it.');
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _post;
    return Scaffold(
      appBar: AppBar(title: const Text('Post'), actions: [
        if (p != null)
          p.mine
              ? IconButton(tooltip: 'Delete post', icon: const Icon(Icons.delete_outline), onPressed: () async {
                  if (!await confirm(context, title: 'Delete this post?', body: 'Its replies will be removed too.')) return;
                  try { await Api.instance.deletePost(p.id); if (context.mounted) context.pop(); } on ApiException catch (e) { if (context.mounted) toast(context, e.message); }
                })
              : IconButton(tooltip: 'Report post', icon: const Icon(Icons.flag_outlined), onPressed: () => _report(postId: p.id)),
      ]),
      body: _loading
          ? const Loading()
          : p == null
              ? Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(_error ?? 'Could not load the post.', onRetry: _load))
              : Column(children: [
                  Expanded(
                    child: ListView(padding: const EdgeInsets.all(Tokens.gutter), children: [
                      Text('${kindLabels[p.kind]} · ${p.handle} · ${ago(p.createdAt)}', style: const TextStyle(color: Tokens.textSecondary, fontSize: 12)),
                      const SizedBox(height: 8),
                      Text(p.title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 8),
                      Text(p.body, style: const TextStyle(height: 1.45)),
                      const SizedBox(height: 8),
                      TextButton.icon(
                        onPressed: () async {
                          setState(() { p.liked = !p.liked; p.likes += p.liked ? 1 : -1; });
                          try { await Api.instance.toggleLike(p.id); } on ApiException {
                            if (mounted) setState(() { p.liked = !p.liked; p.likes += p.liked ? 1 : -1; });
                          }
                        },
                        icon: Icon(p.liked ? Icons.thumb_up : Icons.thumb_up_outlined, size: 18), label: Text('${p.likes}')),
                      Section(title: 'Replies (${_comments.length})', children: [
                        for (final c in _comments)
                          Card(
                            child: ListTile(
                              title: Text('${c.handle}${c.mine ? ' (you)' : ''} · ${ago(c.createdAt)}', style: const TextStyle(fontSize: 12, color: Tokens.textSecondary)),
                              subtitle: Padding(padding: const EdgeInsets.only(top: 4), child: Text(c.body, style: const TextStyle(color: Tokens.textPrimary, height: 1.35))),
                              trailing: c.mine
                                  ? IconButton(tooltip: 'Delete reply', icon: const Icon(Icons.delete_outline, size: 20), onPressed: () async {
                                      try { await Api.instance.deleteComment(c.id); setState(() => _comments = _comments.where((x) => x.id != c.id).toList()); } on ApiException catch (e) { if (context.mounted) toast(context, e.message); }
                                    })
                                  : IconButton(tooltip: 'Report reply', icon: const Icon(Icons.flag_outlined, size: 20), onPressed: () => _report(commentId: c.id)),
                            ),
                          ),
                      ]),
                    ]),
                  ),
                  SafeArea(
                    top: false,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(Tokens.gutter, 6, Tokens.gutter, 10),
                      child: Row(children: [
                        Expanded(child: TextField(controller: _reply, maxLength: 2000, decoration: const InputDecoration(hintText: 'Add a reply…', counterText: ''))),
                        const SizedBox(width: 8),
                        IconButton.filled(tooltip: 'Send reply', style: IconButton.styleFrom(backgroundColor: Tokens.brand), onPressed: _sending ? null : _send, icon: _sending ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.send)),
                      ]),
                    ),
                  ),
                ]),
    );
  }
}
