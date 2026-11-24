import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';
import '../../core/jobs_api.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import 'jobs_screen.dart';

/// "Job tailoring": strengths / optimizations / gaps from the user's real profile. Only ticked skills are added;
/// the optional AI summary is fact-checked server-side against the profile.
class TailorScreen extends StatefulWidget {
  final String jobKey;
  const TailorScreen({super.key, required this.jobKey});
  @override
  State<TailorScreen> createState() => _TailorScreenState();
}

class _TailorScreenState extends State<TailorScreen> {
  TailorPlan? _plan;
  String? _error;
  bool _loading = true, _working = false, _summary = true;
  String _status = '';
  final Set<String> _picked = {};
  ({String resumeId, List<String> added, String? summary, String? note})? _done;
  bool _disposed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final p = await Api.instance.tailorPlan(widget.jobKey);
      _plan = p;
      _picked..clear()..addAll(p.optimizations.map((s) => s.skill));
    } on ApiException catch (e) {
      _error = e.message;
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _run() async {
    setState(() { _working = true; _status = 'Updating your profile and creating the resume…'; });
    try {
      final r = await Api.instance.applyTailor(widget.jobKey, _picked.toList(), _summary);
      if (r.aiJobId == null) return _finish((resumeId: r.resumeId, added: r.added, summary: null, note: r.aiMessage));
      if (mounted) setState(() => _status = 'Writing a role-focused summary from your real experience (this can take a minute)…');
      final t0 = DateTime.now();
      while (!_disposed && DateTime.now().difference(t0) < const Duration(minutes: 3)) {
        await Future<void>.delayed(const Duration(milliseconds: 1500));
        final s = await Api.instance.aiJob(r.aiJobId!);
        if (s['status'] == 'succeeded') {
          try {
            final text = await Api.instance.finishTailor(r.resumeId, r.aiJobId!);
            return _finish((resumeId: r.resumeId, added: r.added, summary: text, note: null));
          } on ApiException catch (e) {
            return _finish((resumeId: r.resumeId, added: r.added, summary: null, note: e.message));
          }
        }
        if (s['status'] == 'failed' || s['status'] == 'cancelled') {
          return _finish((resumeId: r.resumeId, added: r.added, summary: null, note: 'Resume created, but no summary was written: ${s['message'] ?? 'the AI assistant could not finish.'}'));
        }
      }
      _finish((resumeId: r.resumeId, added: r.added, summary: null, note: 'Resume created. The summary is taking too long — you can write it from the editor.'));
    } on ApiException catch (e) {
      if (mounted) setState(() { _working = false; _error = e.message; });
    }
  }

  void _finish(({String resumeId, List<String> added, String? summary, String? note}) d) {
    if (mounted) setState(() { _working = false; _done = d; });
  }

  Widget _row(SkillHit s, {required bool selectable, required String hint}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(children: [
          if (selectable) Checkbox(value: _picked.contains(s.skill), onChanged: _working ? null : (v) => setState(() => v == true ? _picked.add(s.skill) : _picked.remove(s.skill))) else const Padding(padding: EdgeInsets.all(12), child: Icon(Icons.check_circle, size: 20, color: Tokens.success)),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(s.label, style: const TextStyle(fontWeight: FontWeight.w600)), Text(hint, style: const TextStyle(color: Tokens.textSecondary, fontSize: 12))])),
          Text(s.required ? 'REQUIRED' : 'PREFERRED', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: s.required ? Tokens.danger : Tokens.textSecondary)),
        ]),
      );

  Widget _head(String t, int n, Color c) => Padding(padding: const EdgeInsets.only(top: 16, bottom: 4), child: Text('$t ($n)', style: TextStyle(fontWeight: FontWeight.w800, color: c)));

  @override
  Widget build(BuildContext context) {
    final p = _plan;
    return Scaffold(
      appBar: AppBar(title: const Text('Tailor resume')),
      body: _loading
          ? const Loading()
          : p == null
              ? Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(_error ?? 'Could not load this job.', onRetry: _load))
              : ListView(padding: const EdgeInsets.all(Tokens.gutter), children: [
                  Row(children: [CompanyLogo(p.job.logo, p.job.company), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(p.job.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)), Text('${p.job.company} · ${p.job.location}', style: const TextStyle(color: Tokens.textSecondary))]))]),
                  const SizedBox(height: 14),
                  MatchBar(p.match),
                  const SizedBox(height: 10),
                  const Text('We compare the posting with your saved profile. Nothing is added unless you tick it, and the AI may only use facts already on your profile.', style: TextStyle(color: Tokens.textSecondary, fontSize: 12.5)),
                  _head('Strengths', p.strengths.length, Tokens.success),
                  if (p.strengths.isEmpty) const Text('None of this job’s skills are in your skills list yet.', style: TextStyle(color: Tokens.textSecondary)),
                  for (final s in p.strengths) _row(s, selectable: false, hint: 'Already in your resume — no changes needed'),
                  _head('Optimizations', p.optimizations.length, Tokens.textPrimary),
                  if (p.optimizations.isEmpty) const Text('Nothing to surface.', style: TextStyle(color: Tokens.textSecondary)),
                  for (final s in p.optimizations) _row(s, selectable: true, hint: 'Already in your experience — add it to your skills list'),
                  _head('Gaps', p.gaps.length, Tokens.danger),
                  if (p.gaps.isEmpty) const Text('No gaps found.', style: TextStyle(color: Tokens.textSecondary)),
                  for (final s in p.gaps) _row(s, selectable: true, hint: 'Only tick if you really have this skill'),
                  const SizedBox(height: 8),
                  CheckboxListTile(
                    value: _summary, onChanged: _working ? null : (v) => setState(() => _summary = v ?? true), contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading,
                    title: const Text('Role-focused summary', style: TextStyle(fontWeight: FontWeight.w600)), subtitle: const Text('The AI rewrites your summary for this role, then fact-checks it against your profile')),
                  const SizedBox(height: 8),
                  if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 8), child: ErrorBanner(_error!)),
                  if (_working) Card(child: Padding(padding: const EdgeInsets.all(14), child: Row(children: [const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)), const SizedBox(width: 12), Expanded(child: Text(_status))]))),
                  if (_done != null)
                    Card(
                      color: const Color(0xFFE4F6EA),
                      child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Text('Your tailored resume is ready.', style: TextStyle(fontWeight: FontWeight.w800)),
                        if (_done!.added.isNotEmpty) Text('Added to your skills: ${_done!.added.join(', ')}'),
                        if (_done!.summary != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text('Summary: ${_done!.summary}')),
                        if (_done!.note != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(_done!.note!)),
                        const SizedBox(height: 10),
                        GradientButton(label: 'Open resume', onPressed: () => context.pushReplacement('/resumes/${_done!.resumeId}')),
                      ])),
                    )
                  else
                    GradientButton(label: 'Apply selected${_picked.isEmpty ? '' : ' (${_picked.length})'}', busy: _working, onPressed: _run),
                ]),
    );
  }
}
