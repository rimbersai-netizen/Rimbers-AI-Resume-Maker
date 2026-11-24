import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

/// LinkedIn text assistant. We never connect to or post on LinkedIn — the user copies the text.
class LinkedInScreen extends StatefulWidget {
  const LinkedInScreen({super.key});
  @override
  State<LinkedInScreen> createState() => _LinkedInState();
}

class _LinkedInState extends State<LinkedInScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 3, vsync: this);
  final _headline = TextEditingController();
  final _about = TextEditingController();
  LoadedProfile? _profile;
  String? _error;
  String _status = '';
  Set<String> _top = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final p = await Api.instance.loadProfile();
      final row = await Supabase.instance.client.from('master_profiles').select('linkedin').eq('id', p.id).maybeSingle();
      final saved = (row?['linkedin'] as Map?) ?? {};
      _headline.text = (saved['headline'] as String?) ?? '';
      _about.text = (saved['about'] as String?) ?? '';
      final skills = ((p.data['skills'] as List?) ?? []).map((s) => (s as Map)['name'] as String).toList();
      if (mounted) setState(() { _profile = p; _top = skills.take(5).toSet(); });
    } catch (e) {
      if (mounted) setState(() => _error = e is ApiException ? e.message : 'Could not load your profile.');
    }
  }

  Future<void> _save() async {
    setState(() => _status = 'Saving…');
    try {
      await Supabase.instance.client.from('master_profiles').update({'linkedin': {'headline': _headline.text.trim(), 'about': _about.text.trim(), 'updatedAt': DateTime.now().toUtc().toIso8601String()}}).eq('id', _profile!.id);
      if (mounted) setState(() => _status = 'Saved');
    } catch (_) {
      if (mounted) setState(() => _status = 'Too long for LinkedIn or could not save.');
    }
  }

  Future<void> _copy(String text) async {
    await Clipboard.setData(ClipboardData(text: text));
    if (mounted) toast(context, 'Copied');
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) return Scaffold(appBar: AppBar(title: const Text('LinkedIn Assistant')), body: Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(_error!, onRetry: _load)));
    final p = _profile;
    if (p == null) return Scaffold(appBar: AppBar(title: const Text('LinkedIn Assistant')), body: const Loading());
    final per = (p.data['personal'] as Map?) ?? {};
    final ready = ((per['fullName'] as String?) ?? '').isNotEmpty && ((p.data['experience'] as List?) ?? []).isNotEmpty;
    final skills = ((p.data['skills'] as List?) ?? []).map((s) => (s as Map)['name'] as String).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('LinkedIn Assistant'), bottom: TabBar(controller: _tabs, labelColor: Tokens.brand, indicatorColor: Tokens.brand, tabs: const [Tab(text: 'Headline'), Tab(text: 'About'), Tab(text: 'Skills')])),
      body: Column(children: [
        if (!ready) Padding(padding: const EdgeInsets.all(12), child: ErrorBanner('Add your name and at least one role in your profile — LinkedIn text is written only from your real experience.', onRetry: () => context.push('/profile/edit').then((_) => _load()))),
        if (_status.isNotEmpty) Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Align(alignment: AlignmentDirectional.centerEnd, child: Text(_status, style: const TextStyle(color: Tokens.textSecondary, fontSize: 12)))),
        Expanded(
          child: TabBarView(controller: _tabs, children: [
            _GenTab(kind: 'linkedin_headline', profileId: p.id, ready: ready, controller: _headline, maxLen: 220, rows: 3, label: 'LinkedIn headline', copyLabel: 'Copy', onCopy: _copy, onSave: _save, withRole: true),
            _GenTab(kind: 'linkedin_about', profileId: p.id, ready: ready, controller: _about, maxLen: 2600, rows: 12, label: 'About', copyLabel: 'Copy all', onCopy: _copy, onSave: _save),
            ListView(padding: const EdgeInsets.all(Tokens.gutter), children: [
              const Text('Choose up to 5 skills to pin at the top of your LinkedIn profile.', style: TextStyle(color: Tokens.textSecondary)),
              const SizedBox(height: 12),
              if (skills.isEmpty) const Text('Add skills in your profile first.'),
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final s in skills)
                  FilterChip(
                    label: Text(s), selected: _top.contains(s), selectedColor: Tokens.subtle, checkmarkColor: Tokens.brand,
                    onSelected: (v) => setState(() { if (v && _top.length < 5) { _top = {..._top, s}; } else if (!v) { _top = _top.where((x) => x != s).toSet(); } })),
              ]),
              const SizedBox(height: 16),
              Row(children: [
                Expanded(child: OutlineButton(label: 'Copy top skills', onPressed: _top.isEmpty ? null : () => _copy(_top.join(', ')))),
                const SizedBox(width: 10),
                Expanded(child: OutlineButton(label: 'Copy all', onPressed: skills.isEmpty ? null : () => _copy(skills.join(', ')))),
              ]),
            ]),
          ]),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              OutlineButton(label: 'Open LinkedIn', icon: Icons.open_in_new, onPressed: () {
                final url = per['linkedin'] as String?;
                final ok = url != null && RegExp(r'^https://([a-z]+\.)?linkedin\.com/', caseSensitive: false).hasMatch(url);
                launchUrl(Uri.parse(ok ? url : 'https://www.linkedin.com/'), mode: LaunchMode.externalApplication);
              }),
              const SizedBox(height: 4),
              const Text('We never connect to or post on your LinkedIn account — copy the text and paste it yourself.', style: TextStyle(color: Tokens.textSecondary, fontSize: 11), textAlign: TextAlign.center),
            ]),
          ),
        ),
      ]),
    );
  }
}

class _GenTab extends StatefulWidget {
  final String kind, profileId, label, copyLabel;
  final bool ready, withRole;
  final TextEditingController controller;
  final int maxLen, rows;
  final Future<void> Function(String) onCopy;
  final Future<void> Function() onSave;
  const _GenTab({required this.kind, required this.profileId, required this.ready, required this.controller, required this.maxLen, required this.rows, required this.label, required this.copyLabel, required this.onCopy, required this.onSave, this.withRole = false});
  @override
  State<_GenTab> createState() => _GenTabState();
}

class _GenTabState extends State<_GenTab> with AutomaticKeepAliveClientMixin {
  final _runner = AiRunner();
  final _suggestion = TextEditingController();
  final _role = TextEditingController();
  String _tone = 'professional';

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _runner.addListener(() {
      final o = _runner.output;
      if (_runner.state == 'ready' && o != null) _suggestion.text = ((o['headline'] ?? o['about']) as String?) ?? '';
    });
  }

  @override
  void dispose() {
    _runner.dispose();
    super.dispose();
  }

  void _go() => _runner.start({'kind': widget.kind, 'masterProfileId': widget.profileId, 'locale': 'en', 'tone': _tone, if (widget.withRole && _role.text.trim().isNotEmpty) 'targetRole': _role.text.trim()});

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return ListView(padding: const EdgeInsets.all(Tokens.gutter), children: [
      TextField(controller: widget.controller, minLines: widget.rows, maxLines: widget.rows + 6, maxLength: widget.maxLen, decoration: InputDecoration(labelText: widget.label, alignLabelWithHint: true)),
      Row(children: [
        Expanded(child: OutlineButton(label: widget.copyLabel, icon: Icons.copy, onPressed: widget.controller.text.isEmpty ? null : () => widget.onCopy(widget.controller.text))),
        const SizedBox(width: 10),
        Expanded(child: GradientButton(label: 'Save', onPressed: widget.onSave)),
      ]),
      Section(title: 'Generate with AI', children: [
        DropdownButtonFormField<String>(value: _tone, decoration: const InputDecoration(labelText: 'Tone'), items: [for (final t in const ['professional', 'confident', 'friendly']) DropdownMenuItem(value: t, child: Text(t[0].toUpperCase() + t.substring(1)))], onChanged: (v) => setState(() => _tone = v!)),
        if (widget.withRole) ...[const SizedBox(height: 12), TextField(controller: _role, maxLength: 120, decoration: const InputDecoration(labelText: 'Target role (optional)', counterText: ''))],
        const SizedBox(height: 12),
        ListenableBuilder(listenable: _runner, builder: (_, __) => (_runner.state == 'idle' || _runner.state == 'error') ? GradientButton(label: 'Generate with AI', leading: Icons.auto_awesome, onPressed: widget.ready ? _go : null) : const SizedBox.shrink()),
        const SizedBox(height: 10),
        AiPanel(
          runner: _runner, onRetry: _go, onSeePlans: () => context.push('/plans'),
          resultBuilder: (context, out) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('AI suggestion — edit freely', style: TextStyle(fontWeight: FontWeight.w700, color: Tokens.brand)),
            const SizedBox(height: 8),
            TextField(controller: _suggestion, minLines: 3, maxLines: 14, maxLength: widget.maxLen),
            Row(children: [
              Expanded(flex: 2, child: GradientButton(label: 'Use this', onPressed: () { widget.controller.text = _suggestion.text.trim(); _runner.reset(); widget.onSave(); })),
              const SizedBox(width: 10),
              Expanded(child: OutlineButton(label: 'Regenerate', onPressed: _go)),
            ]),
            TextButton(onPressed: _runner.reset, child: const Text('Discard')),
          ]),
        ),
      ]),
    ]);
  }
}
