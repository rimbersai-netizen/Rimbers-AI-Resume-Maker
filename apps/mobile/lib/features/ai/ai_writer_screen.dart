import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../home/shell.dart';

const _tones = ['professional', 'confident', 'friendly', 'formal', 'concise'];

/// AI writing assistant for the professional summary. Suggestions are labelled, editable, and only applied on Accept.
class AiWriterScreen extends ConsumerStatefulWidget {
  const AiWriterScreen({super.key});
  @override
  ConsumerState<AiWriterScreen> createState() => _AiWriterState();
}

class _AiWriterState extends ConsumerState<AiWriterScreen> {
  final _runner = AiRunner();
  LoadedProfile? _profile;
  String? _loadError;
  String _mode = 'write';
  String _tone = 'professional';
  String _length = 'medium';
  final _text = TextEditingController();
  bool _applied = false;

  @override
  void initState() {
    super.initState();
    _load();
    _runner.addListener(_onRunner);
  }

  @override
  void dispose() {
    _runner.removeListener(_onRunner);
    _runner.dispose();
    super.dispose();
  }

  void _onRunner() {
    final o = _runner.output;
    if (_runner.state == 'ready' && o != null && o['summary'] is String) _text.text = o['summary'] as String;
  }

  Future<void> _load() async {
    try {
      final p = await Api.instance.loadProfile();
      if (mounted) setState(() => _profile = p);
    } on ApiException catch (e) {
      if (mounted) setState(() => _loadError = e.message);
    }
  }

  bool get _hasSummary => ((_profile?.data['summary'] as String?) ?? '').trim().isNotEmpty;

  void _go() {
    final id = _profile!.id;
    final base = {'masterProfileId': id, 'locale': 'en'};
    _runner.start(switch (_mode) {
      'write' => {'kind': 'summary', ...base, 'tone': _tone, 'length': _length},
      'grammar' => {'kind': 'grammar', ...base, 'target': {'type': 'summary'}},
      _ => {'kind': 'tone', ...base, 'tone': _tone, 'target': {'type': 'summary'}},
    });
  }

  Future<void> _accept() async {
    final p = _profile!;
    p.data['summary'] = _text.text.trim();
    try {
      p.updatedAt = await Api.instance.saveProfile(p);
      ref.invalidate(profileProvider);
      _runner.reset();
      if (mounted) setState(() => _applied = true);
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loadError != null) return Scaffold(appBar: AppBar(title: const Text('AI Writing Assistant')), body: Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(_loadError!, onRetry: _load)));
    if (_profile == null) return Scaffold(appBar: AppBar(title: const Text('AI Writing Assistant')), body: const Loading());
    final personal = _profile!.data['personal'] as Map?;
    final ready = ((personal?['fullName'] as String?) ?? '').trim().isNotEmpty;
    return Scaffold(
      appBar: AppBar(title: const Text('AI Writing Assistant')),
      body: ListView(padding: const EdgeInsets.all(Tokens.gutter), children: [
        if (!ready) Padding(padding: const EdgeInsets.only(bottom: 12), child: ErrorBanner('Complete your profile first — the AI writes only from your real experience.', onRetry: () => context.push('/profile/edit').then((_) => _load()))),
        SegmentedButton<String>(
          segments: [
            const ButtonSegment(value: 'write', label: Text('Write new')),
            ButtonSegment(value: 'grammar', label: const Text('Fix grammar'), enabled: _hasSummary),
            ButtonSegment(value: 'tone', label: const Text('Change tone'), enabled: _hasSummary),
          ],
          selected: {_mode}, onSelectionChanged: (s) => setState(() { _mode = s.first; _runner.reset(); }),
        ),
        if (!_hasSummary) const Padding(padding: EdgeInsets.only(top: 6), child: Text('Write a summary first to enable grammar and tone tools.', style: TextStyle(color: Tokens.textSecondary, fontSize: 12))),
        if (_hasSummary) Section(title: 'Current summary', children: [Card(child: Padding(padding: const EdgeInsets.all(14), child: Text(_profile!.data['summary'] as String)))]),
        const SizedBox(height: 12),
        if (_mode != 'grammar') DropdownButtonFormField<String>(value: _tone, decoration: const InputDecoration(labelText: 'Writing tone'), items: [for (final t in _tones) DropdownMenuItem(value: t, child: Text(t[0].toUpperCase() + t.substring(1)))], onChanged: (v) => setState(() => _tone = v!)),
        if (_mode == 'write') ...[
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(value: _length, decoration: const InputDecoration(labelText: 'Length'), items: const [DropdownMenuItem(value: 'short', child: Text('Short')), DropdownMenuItem(value: 'medium', child: Text('Medium')), DropdownMenuItem(value: 'long', child: Text('Long'))], onChanged: (v) => setState(() => _length = v!)),
        ],
        const SizedBox(height: 16),
        ListenableBuilder(listenable: _runner, builder: (_, __) => _runner.state == 'idle' || _runner.state == 'error'
            ? GradientButton(label: _mode == 'write' ? 'Generate with AI' : _mode == 'grammar' ? 'Fix grammar' : 'Rewrite in this tone', leading: Icons.auto_awesome, onPressed: ready ? _go : null)
            : const SizedBox.shrink()),
        const SizedBox(height: 12),
        AiPanel(
          runner: _runner, onRetry: _go, onSeePlans: () => context.push('/plans'),
          resultBuilder: (context, out) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('AI suggestion — you can edit it', style: TextStyle(fontWeight: FontWeight.w700, color: Tokens.brand)),
            const SizedBox(height: 8),
            TextField(controller: _text, minLines: 5, maxLines: 10, maxLength: 1200),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(flex: 2, child: GradientButton(label: 'Use this summary', onPressed: _accept)),
              const SizedBox(width: 10),
              Expanded(child: OutlineButton(label: 'Regenerate', onPressed: _go)),
            ]),
            TextButton(onPressed: _runner.reset, child: const Text('Discard')),
          ]),
        ),
        if (_applied) const Padding(padding: EdgeInsets.only(top: 12), child: Card(child: ListTile(leading: Icon(Icons.check_circle, color: Tokens.success), title: Text('Summary saved to your profile')))),
      ]),
    );
  }
}
