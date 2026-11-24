import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

const _bandText = {
  'strong': ('Excellent!', 'Your resume looks highly ATS-friendly and well optimized.'),
  'good': ('Good', 'A solid resume — a few improvements will make it stronger.'),
  'fair': ('Fair', 'Several things could trip up parsers or recruiters. See the suggestions below.'),
  'needs_work': ('Needs work', 'Fix the critical items below first.'),
};

/// Which profile step fixes each category (tap-through from a finding).
const _fixStep = {'contact': 0, 'completeness': 0, 'experience': 1, 'readability': 1, 'formatting': 0, 'job_match': 3};

class AtsScreen extends StatefulWidget {
  final String resumeId;
  const AtsScreen({super.key, required this.resumeId});
  @override
  State<AtsScreen> createState() => _AtsState();
}

class _AtsState extends State<AtsScreen> {
  final _jd = TextEditingController();
  Map<String, dynamic>? _result;
  bool _busy = false;
  String? _error;
  bool _withJd = false;

  @override
  void initState() {
    super.initState();
    _run();
  }

  Future<void> _run() async {
    final jd = _jd.text.trim();
    setState(() { _busy = true; _error = null; });
    try {
      final r = await Api.instance.analyze(widget.resumeId, jobDescription: jd);
      if (mounted) setState(() { _result = r; _withJd = jd.isNotEmpty; });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = _result;
    return Scaffold(
      appBar: AppBar(title: const Text('ATS Analysis')),
      body: ListView(padding: const EdgeInsets.all(Tokens.gutter), children: [
        if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: ErrorBanner(_error!, onRetry: _run)),
        if (r == null && _error == null) const Padding(padding: EdgeInsets.all(40), child: Loading(label: 'Analyzing your resume…')),
        if (r != null) ..._results(r),
        Section(title: 'Match to a job description', children: [
          const Text('Paste a job posting to see which keywords you cover. Only skills you already list are counted — nothing is invented.', style: TextStyle(color: Tokens.textSecondary)),
          const SizedBox(height: 10),
          TextField(controller: _jd, minLines: 5, maxLines: 10, maxLength: 20000, decoration: const InputDecoration(hintText: 'Paste the job description here…', alignLabelWithHint: true)),
          const SizedBox(height: 8),
          GradientButton(label: _withJd ? 'Re-analyze' : 'Analyze with job description', busy: _busy, leading: Icons.gps_fixed, onPressed: _jd.text.trim().isEmpty && !_withJd ? null : _run),
        ]),
        const SizedBox(height: 24),
      ]),
    );
  }

  List<Widget> _results(Map<String, dynamic> r) {
    final overall = (r['overall'] as num).round();
    final band = _bandText[r['band']] ?? _bandText['fair']!;
    final cats = (r['categories'] as List).cast<Map<String, dynamic>>();
    final km = r['keywordMatch'] as Map<String, dynamic>?;
    List<String> terms(String k) => ((km?[k] as List?) ?? []).map((e) => '${(e as Map)['term']}').toList();
    return [
      Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            ScoreRing(score: overall),
            const SizedBox(width: 16),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(band.$1, style: TextStyle(color: scoreColor(overall), fontWeight: FontWeight.w800, fontSize: 20)),
              const SizedBox(height: 4),
              Text(band.$2, style: const TextStyle(color: Tokens.textSecondary)),
              const SizedBox(height: 4),
              const Text('Estimated score', style: TextStyle(color: Tokens.textSecondary, fontSize: 12)),
            ])),
          ]),
        ),
      ),
      const SizedBox(height: 12),
      for (final c in cats) _CategoryTile(c, onFix: () => context.push('/profile/edit?step=${_fixStep[c['id']] ?? 0}')),
      if (km != null) ...[
        Section(title: 'Keywords · ${(km['score'] as num).round()}% coverage', children: [
          const Text('Found in your resume', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          terms('matched').isEmpty ? const Text('None yet', style: TextStyle(color: Tokens.textSecondary)) : Wrap(spacing: 6, runSpacing: 6, children: [for (final t in terms('matched')) Chip(label: Text(t), avatar: const Icon(Icons.check, size: 16, color: Tokens.success))]),
          const SizedBox(height: 12),
          const Text('Missing from your resume', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          terms('missing').isEmpty ? const Text('Nothing important is missing 🎉', style: TextStyle(color: Tokens.textSecondary)) : Wrap(spacing: 6, runSpacing: 6, children: [for (final t in terms('missing')) Chip(label: Text(t), backgroundColor: const Color(0xFFFFF4E0))]),
          const SizedBox(height: 8),
          const Text('Add a missing keyword only if you truly have that skill or experience.', style: TextStyle(color: Tokens.textSecondary, fontSize: 12)),
        ]),
      ],
      const SizedBox(height: 12),
      Text(r['disclaimer'] as String, style: const TextStyle(color: Tokens.textSecondary, fontSize: 12)),
    ];
  }
}

class _CategoryTile extends StatelessWidget {
  final Map<String, dynamic> c;
  final VoidCallback onFix;
  const _CategoryTile(this.c, {required this.onFix});
  @override
  Widget build(BuildContext context) {
    final score = (c['score'] as num).round();
    final findings = (c['findings'] as List).cast<Map<String, dynamic>>();
    final problems = findings.where((f) => f['severity'] != 'info').toList();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        child: ExpansionTile(
          shape: const Border(), collapsedShape: const Border(),
          leading: Icon(score >= 80 ? Icons.check_circle : Icons.info, color: scoreColor(score)),
          title: Text(c['label'] as String, style: const TextStyle(fontWeight: FontWeight.w600)),
          trailing: Text('$score%', style: TextStyle(fontWeight: FontWeight.w700, color: scoreColor(score))),
          subtitle: problems.isEmpty ? null : Text('${problems.length} suggestion${problems.length == 1 ? '' : 's'}', style: const TextStyle(fontSize: 12)),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          expandedCrossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final f in findings)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(f['severity'] == 'critical' ? Icons.error : f['severity'] == 'warning' ? Icons.warning_amber : Icons.check_circle_outline, size: 18, color: f['severity'] == 'critical' ? Tokens.danger : f['severity'] == 'warning' ? Tokens.warning : Tokens.success),
                  const SizedBox(width: 8),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(f['message'] as String),
                    if (f['suggestion'] != null) Text(f['suggestion'] as String, style: const TextStyle(color: Tokens.textSecondary, fontSize: 13)),
                  ])),
                ]),
              ),
            if (problems.isNotEmpty) Align(alignment: AlignmentDirectional.centerStart, child: TextButton.icon(onPressed: onFix, icon: const Icon(Icons.edit_outlined, size: 18), label: const Text('Go fix this'))),
          ],
        ),
      ),
    );
  }
}
