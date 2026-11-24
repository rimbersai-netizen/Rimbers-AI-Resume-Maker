import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api.dart';
import '../../core/config.dart';
import '../../core/data.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../home/shell.dart';

final lettersProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final rows = await Supabase.instance.client.from('cover_letters').select('id,title,locale,updated_at').order('updated_at', ascending: false).limit(50);
  return (rows as List).cast<Map<String, dynamic>>();
});

class CoverLettersScreen extends ConsumerWidget {
  const CoverLettersScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final letters = ref.watch(lettersProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Cover Letters')),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: Tokens.brand, foregroundColor: Colors.white, icon: const Icon(Icons.add), label: const Text('New letter'),
        onPressed: () => context.push('/cover-letters/new').then((_) => ref.invalidate(lettersProvider))),
      body: letters.when(
        loading: () => const Loading(),
        error: (_, __) => Padding(padding: const EdgeInsets.all(16), child: ErrorBanner('Could not load your letters.', onRetry: () => ref.invalidate(lettersProvider))),
        data: (list) => list.isEmpty
            ? const EmptyState(icon: Icons.mail_outline, title: 'No cover letters yet', body: 'Generate a letter from your real experience for any job.')
            : ListView.separated(
                padding: const EdgeInsets.all(Tokens.gutter), itemCount: list.length, separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (_, i) {
                  final l = list[i];
                  return Card(
                    child: ListTile(
                      leading: const CircleAvatar(backgroundColor: Tokens.subtle, child: Icon(Icons.mail_outline, color: Tokens.brand)),
                      title: Text((l['title'] as String?) ?? 'Cover letter', style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text('${(l['locale'] as String).toUpperCase()} · Updated ${ago(DateTime.parse(l['updated_at'] as String))}'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/cover-letters/${l['id']}').then((_) => ref.invalidate(lettersProvider)),
                    ),
                  );
                },
              ),
      ),
    );
  }
}

class NewCoverLetterScreen extends ConsumerStatefulWidget {
  const NewCoverLetterScreen({super.key});
  @override
  ConsumerState<NewCoverLetterScreen> createState() => _NewLetterState();
}

class _NewLetterState extends ConsumerState<NewCoverLetterScreen> {
  final _job = TextEditingController();
  final _company = TextEditingController();
  final _points = TextEditingController();
  final _jd = TextEditingController();
  final _letter = TextEditingController();
  final _runner = AiRunner();
  String _tone = 'professional';
  String _locale = 'en';
  LoadedProfile? _profile;
  String? _error;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    Api.instance.loadProfile().then((p) { if (mounted) setState(() => _profile = p); }).catchError((_) {});
    _runner.addListener(() {
      final o = _runner.output;
      if (_runner.state == 'ready' && o != null && o['letter'] is String) _letter.text = o['letter'] as String;
    });
  }

  @override
  void dispose() {
    _runner.dispose();
    super.dispose();
  }

  void _generate() {
    if (_job.text.trim().length < 2) return setState(() => _error = 'Enter the job title.');
    setState(() => _error = null);
    _runner.start({
      'kind': 'cover_letter', 'masterProfileId': _profile!.id, 'tone': _tone, 'locale': _locale, 'jobTitle': _job.text.trim(),
      if (_company.text.trim().isNotEmpty) 'company': _company.text.trim(),
      if (_points.text.trim().isNotEmpty) 'keyPoints': _points.text.trim(),
      if (_jd.text.trim().isNotEmpty) 'jobDescription': _jd.text.trim(),
    });
  }

  Future<void> _save(String body) async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;
    setState(() { _saving = true; _error = null; });
    try {
      final row = await Supabase.instance.client.from('cover_letters').insert({
        'user_id': user.id, 'title': _job.text.trim().isEmpty ? 'Cover letter' : _job.text.trim(), 'body': body, 'locale': _locale,
        'job_title': _job.text.trim().isEmpty ? null : _job.text.trim(), 'company': _company.text.trim().isEmpty ? null : _company.text.trim(),
      }).select('id').single();
      if (mounted) context.pushReplacement('/cover-letters/${row['id']}');
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not save the cover letter.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ready = ((_profile?.data['personal'] as Map?)?['fullName'] as String?)?.trim().isNotEmpty == true;
    return Scaffold(
      appBar: AppBar(title: const Text('Cover Letter Generator')),
      body: ListView(padding: const EdgeInsets.all(Tokens.gutter), children: [
        if (_profile != null && !ready) Padding(padding: const EdgeInsets.only(bottom: 12), child: ErrorBanner('Complete your profile first — letters are written only from your real experience.', onRetry: () => context.push('/profile/edit').then((_) => Api.instance.loadProfile().then((p) => setState(() => _profile = p))))),
        TextField(controller: _job, maxLength: 200, decoration: const InputDecoration(labelText: 'Job title *', hintText: 'Software Engineer', counterText: '')),
        const SizedBox(height: 12),
        TextField(controller: _company, maxLength: 200, decoration: const InputDecoration(labelText: 'Company (optional)', counterText: '')),
        const SizedBox(height: 12),
        TextField(controller: _points, maxLength: 1000, decoration: const InputDecoration(labelText: 'Key points (optional)', hintText: 'React, team leadership, available from March', counterText: '')),
        const SizedBox(height: 12),
        TextField(controller: _jd, minLines: 3, maxLines: 6, maxLength: 20000, decoration: const InputDecoration(labelText: 'Job description (optional, improves matching)', alignLabelWithHint: true)),
        Row(children: [
          Expanded(child: DropdownButtonFormField<String>(value: _tone, decoration: const InputDecoration(labelText: 'Tone'), items: [for (final t in const ['professional', 'confident', 'friendly', 'formal', 'concise']) DropdownMenuItem(value: t, child: Text(t[0].toUpperCase() + t.substring(1)))], onChanged: (v) => setState(() => _tone = v!))),
          const SizedBox(width: 10),
          Expanded(child: DropdownButtonFormField<String>(isExpanded: true, value: _locale, decoration: const InputDecoration(labelText: 'Language'), items: [for (final e in resumeLanguages.entries) DropdownMenuItem(value: e.key, child: Text(e.value, overflow: TextOverflow.ellipsis))], onChanged: (v) => setState(() => _locale = v!))),
        ]),
        const SizedBox(height: 16),
        if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: ErrorBanner(_error!)),
        ListenableBuilder(listenable: _runner, builder: (_, __) => (_runner.state == 'idle' || _runner.state == 'error')
            ? Column(children: [
                GradientButton(label: 'Generate with AI', leading: Icons.auto_awesome, onPressed: ready && _profile != null ? _generate : null),
                TextButton(onPressed: _saving ? null : () => _save('Dear Hiring Manager,\n\n\n\nSincerely,\n'), child: const Text('Write it myself')),
              ])
            : const SizedBox.shrink()),
        const SizedBox(height: 8),
        AiPanel(
          runner: _runner, onRetry: _generate, onSeePlans: () => context.push('/plans'),
          resultBuilder: (context, out) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('AI draft — edit before saving', style: TextStyle(fontWeight: FontWeight.w700, color: Tokens.brand)),
            const SizedBox(height: 8),
            TextField(controller: _letter, minLines: 10, maxLines: 20, maxLength: 20000),
            const SizedBox(height: 8),
            GradientButton(label: 'Save letter', busy: _saving, onPressed: () => _save(_letter.text)),
            Row(children: [Expanded(child: TextButton(onPressed: _generate, child: const Text('Regenerate'))), Expanded(child: TextButton(onPressed: _runner.reset, child: const Text('Discard')))]),
          ]),
        ),
        const SizedBox(height: 24),
      ]),
    );
  }
}

class CoverLetterEditorScreen extends StatefulWidget {
  final String id;
  const CoverLetterEditorScreen({super.key, required this.id});
  @override
  State<CoverLetterEditorScreen> createState() => _LetterEditorState();
}

class _LetterEditorState extends State<CoverLetterEditorScreen> {
  final _title = TextEditingController();
  final _body = TextEditingController();
  bool _loaded = false;
  String? _error;
  String _status = 'saved';
  Timer? _debounce;
  String _exportState = 'idle';
  String? _exportError;
  bool _upgrade = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final row = await Supabase.instance.client.from('cover_letters').select('title,body').eq('id', widget.id).maybeSingle();
      if (row == null) return setState(() => _error = 'This letter no longer exists.');
      _title.text = (row['title'] as String?) ?? '';
      _body.text = row['body'] as String;
      setState(() => _loaded = true);
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not load the letter.');
    }
  }

  void _changed() {
    setState(() => _status = 'saving');
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 800), _save);
  }

  Future<void> _save() async {
    try {
      await Supabase.instance.client.from('cover_letters').update({'title': _title.text.trim().isEmpty ? 'Cover letter' : _title.text.trim(), 'body': _body.text}).eq('id', widget.id);
      if (mounted) setState(() => _status = 'saved');
    } catch (_) {
      if (mounted) setState(() => _status = 'error');
    }
  }

  Future<void> _export(String format) async {
    await _save();
    setState(() { _exportState = 'working'; _exportError = null; _upgrade = false; });
    try {
      final r = await Api.instance.post('/exports', {'coverLetterId': widget.id, 'format': format});
      final id = (r['value'] as Map)['id'] as String;
      for (var i = 0; i < 90; i++) {
        await Future<void>.delayed(const Duration(seconds: 2));
        if (!mounted) return;
        final s = await Api.instance.exportState(id);
        if (s['status'] == 'succeeded' && s['url'] != null) {
          setState(() => _exportState = 'idle');
          return _share(Config.fixHost(s['url'] as String), format);
        }
        if (s['status'] == 'failed') throw ApiException((s['error'] as String?) ?? 'The export failed.');
      }
      throw ApiException('The document service is busy. Please try again.');
    } on ApiException catch (e) {
      if (mounted) setState(() { _exportState = 'error'; _exportError = e.message; _upgrade = e.upgrade; });
    }
  }

  Future<void> _share(String url, String format) async {
    try {
      if (kIsWeb) {
        await launchUrl(Uri.parse(url));
        return;
      }
      final r = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 60));
      if (r.statusCode != 200) throw Exception('download');
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/cover-letter.$format');
      await file.writeAsBytes(r.bodyBytes);
      await Share.shareXFiles([XFile(file.path)], subject: _title.text);
    } catch (_) {
      if (mounted) toast(context, 'Could not download the file.');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) return Scaffold(appBar: AppBar(), body: Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(_error!)));
    if (!_loaded) return Scaffold(appBar: AppBar(), body: const Loading());
    return Scaffold(
      appBar: AppBar(title: const Text('Cover Letter'), actions: [
        Center(child: Padding(padding: const EdgeInsets.only(right: 8), child: Text(_status == 'saving' ? 'Saving…' : _status == 'error' ? 'Not saved' : 'Saved', style: TextStyle(color: _status == 'error' ? Tokens.danger : Tokens.textSecondary, fontSize: 13)))),
        IconButton(tooltip: 'Delete letter', icon: const Icon(Icons.delete_outline), onPressed: () async {
          if (!await confirm(context, title: 'Delete this letter?', body: 'This cannot be undone.')) return;
          await Supabase.instance.client.from('cover_letters').delete().eq('id', widget.id);
          if (context.mounted) context.pop();
        }),
      ]),
      body: ListView(padding: const EdgeInsets.all(Tokens.gutter), children: [
        TextField(controller: _title, maxLength: 200, onChanged: (_) => _changed(), decoration: const InputDecoration(labelText: 'Title', counterText: '')),
        const SizedBox(height: 12),
        TextField(controller: _body, minLines: 14, maxLines: 40, maxLength: 20000, onChanged: (_) => _changed(), decoration: const InputDecoration(alignLabelWithHint: true)),
        const SizedBox(height: 12),
        if (_exportState == 'error') Padding(padding: const EdgeInsets.only(bottom: 12), child: ErrorBanner(_exportError ?? 'Export failed.', onUpgrade: _upgrade ? () => context.push('/plans') : null)),
        Row(children: [
          Expanded(child: GradientButton(label: 'PDF', leading: Icons.picture_as_pdf_outlined, busy: _exportState == 'working', onPressed: () => _export('pdf'))),
          const SizedBox(width: 10),
          Expanded(child: OutlineButton(label: 'DOCX', icon: Icons.description_outlined, onPressed: _exportState == 'working' ? null : () => _export('docx'))),
        ]),
        const SizedBox(height: 8),
        const Text('Make sure every statement is true before sending — AI drafts can contain mistakes.', style: TextStyle(color: Tokens.textSecondary, fontSize: 12)),
      ]),
    );
  }
}
