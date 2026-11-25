import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/data.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../home/shell.dart';

/// Interview Prep — Professional plan and above. Likely questions for a target role, each with a coaching tip and talking
/// points taken only from the user's own profile. Access is enforced on the server; this screen only explains and links to plans.
class InterviewPrepScreen extends ConsumerStatefulWidget {
  final String? role, company;
  const InterviewPrepScreen({super.key, this.role, this.company});
  @override
  ConsumerState<InterviewPrepScreen> createState() => _InterviewPrepState();
}

class _InterviewPrepState extends ConsumerState<InterviewPrepScreen> {
  final _runner = AiRunner();
  late final _role = TextEditingController(text: widget.role ?? '');
  late final _company = TextEditingController(text: widget.company ?? '');
  final _jd = TextEditingController();
  String? _formError;

  @override
  void dispose() {
    _runner.dispose();
    _role.dispose();
    _company.dispose();
    _jd.dispose();
    super.dispose();
  }

  Future<void> _go() async {
    final role = _role.text.trim();
    if (role.length < 2) return setState(() => _formError = 'Enter the role you are interviewing for.');
    setState(() => _formError = null);
    try {
      final p = await ref.read(profileProvider.future);
      final name = ((p.data['personal'] as Map?)?['fullName'] as String?) ?? '';
      if (name.trim().isEmpty) return setState(() => _formError = 'Add your name in your profile first — questions are based on your experience.');
      _runner.start({
        'kind': 'interview_prep', 'masterProfileId': p.id, 'locale': 'en', 'jobTitle': role, 'count': 8,
        if (_company.text.trim().isNotEmpty) 'company': _company.text.trim(),
        if (_jd.text.trim().isNotEmpty) 'jobDescription': _jd.text.trim(),
      });
    } catch (_) {
      setState(() => _formError = 'Could not load your profile. Please try again.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final plan = ref.watch(planProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Interview Prep')),
      body: plan.when(
        loading: () => const Loading(),
        error: (_, __) => Padding(padding: const EdgeInsets.all(16), child: ErrorBanner('Could not check your plan.', onRetry: () => ref.invalidate(planProvider))),
        data: (p) => p['interviewPrep'] == true ? _form(context) : const InterviewProLock(),
      ),
    );
  }

  Widget _form(BuildContext context) => ListView(padding: const EdgeInsets.all(Tokens.gutter), children: [
        const Text('Practise the questions you are most likely to be asked — with talking points from your own experience.', style: TextStyle(color: Tokens.textSecondary)),
        Section(title: 'The interview', children: [
          TextField(controller: _role, maxLength: 200, textInputAction: TextInputAction.next, decoration: const InputDecoration(labelText: 'Role you are interviewing for *', counterText: '')),
          const SizedBox(height: 12),
          TextField(controller: _company, maxLength: 200, textInputAction: TextInputAction.next, decoration: const InputDecoration(labelText: 'Company (optional)', counterText: '')),
          const SizedBox(height: 12),
          TextField(controller: _jd, minLines: 3, maxLines: 8, maxLength: 20000, decoration: const InputDecoration(labelText: 'Job description (optional — makes questions more specific)', alignLabelWithHint: true, counterText: '')),
          if (_formError != null) Padding(padding: const EdgeInsets.only(top: 8), child: ErrorBanner(_formError!)),
          const SizedBox(height: 12),
          ListenableBuilder(
            listenable: _runner,
            builder: (_, __) => (_runner.state == 'idle' || _runner.state == 'error' || _runner.state == 'ready')
                ? GradientButton(label: _runner.state == 'ready' ? 'Generate new questions' : 'Generate questions', leading: Icons.auto_awesome, onPressed: _go)
                : const SizedBox.shrink(),
          ),
        ]),
        const SizedBox(height: 12),
        AiPanel(runner: _runner, onRetry: _go, onSeePlans: () => context.push('/plans'), resultBuilder: (_, out) => InterviewResults(output: out)),
      ]);
}

/// Shown to Free and Standard users: what Interview Prep is and how to get it.
class InterviewProLock extends StatelessWidget {
  const InterviewProLock({super.key});
  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.all(Tokens.gutter), children: [
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(gradient: Tokens.gradient, borderRadius: BorderRadius.circular(Tokens.rCard)),
          child: Column(children: [
            Container(
              width: 64, height: 64, decoration: BoxDecoration(color: Colors.white.withOpacity(.18), shape: BoxShape.circle),
              child: const Icon(Icons.lock_outline, color: Colors.white, size: 32),
            ),
            const SizedBox(height: 14),
            const Text('Interview Prep is a Pro feature', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            const Text('Included in the Professional plan and above.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white70)),
          ]),
        ),
        const SizedBox(height: 20),
        for (final b in const [
          (Icons.quiz_outlined, 'Likely questions for your target role', 'Behavioral, technical and situational — tailored to the job.'),
          (Icons.tips_and_updates_outlined, 'How to answer each one', 'A short coaching tip for every question.'),
          (Icons.verified_user_outlined, 'Talking points from YOUR experience', 'Only real roles and skills from your profile — nothing invented.'),
          (Icons.flag_outlined, 'Know your gaps', 'Skills the job asks for that you should be ready to discuss honestly.'),
        ])
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(width: 42, height: 42, decoration: BoxDecoration(color: Tokens.subtle, borderRadius: BorderRadius.circular(12)), child: Icon(b.$1, color: Tokens.brand)),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(b.$2, style: const TextStyle(fontWeight: FontWeight.w700)), Text(b.$3, style: const TextStyle(color: Tokens.textSecondary))])),
            ]),
          ),
        const SizedBox(height: 8),
        GradientButton(label: 'See plans', leading: Icons.workspace_premium_outlined, onPressed: () => context.push('/plans')),
      ]);
}

const _categoryStyle = {
  'behavioral': ('Behavioral', Color(0xFF2563EB)),
  'technical': ('Technical', Color(0xFF7C3AED)),
  'role': ('Role', Color(0xFF0E7490)),
  'situational': ('Situational', Color(0xFFD97706)),
  'motivation': ('Motivation', Color(0xFF047857)),
};

/// Question cards for a finished `interview_prep` job.
class InterviewResults extends StatelessWidget {
  final Map<String, dynamic> output;
  const InterviewResults({super.key, required this.output});

  @override
  Widget build(BuildContext context) {
    final questions = ((output['questions'] as List?) ?? const []).cast<Map>();
    final gaps = ((output['gaps'] as List?) ?? const []).cast<String>();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (gaps.isNotEmpty)
        Container(
          width: double.infinity, margin: const EdgeInsets.only(bottom: 12), padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: Tokens.warning.withOpacity(.12), borderRadius: BorderRadius.circular(Tokens.rInput)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Be ready to discuss', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text('The job mentions ${gaps.join(', ')} — not in your profile. Prepare an honest answer about your experience with these.', style: const TextStyle(color: Tokens.textSecondary)),
          ]),
        ),
      Text('${questions.length} questions', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
      const SizedBox(height: 8),
      for (var i = 0; i < questions.length; i++) _QuestionCard(index: i + 1, q: questions[i].cast<String, dynamic>()),
    ]);
  }
}

class _QuestionCard extends StatefulWidget {
  final int index;
  final Map<String, dynamic> q;
  const _QuestionCard({required this.index, required this.q});
  @override
  State<_QuestionCard> createState() => _QuestionCardState();
}

class _QuestionCardState extends State<_QuestionCard> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final q = widget.q;
    final cat = _categoryStyle[q['category']] ?? ('General', Tokens.brand);
    final points = ((q['talkingPoints'] as List?) ?? const []).cast<String>();
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(color: Tokens.surface, borderRadius: BorderRadius.circular(Tokens.rCard), border: Border.all(color: Tokens.border), boxShadow: Tokens.shadow),
      child: InkWell(
        borderRadius: BorderRadius.circular(Tokens.rCard), onTap: () => setState(() => _open = !_open),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3), decoration: BoxDecoration(color: cat.$2.withOpacity(.12), borderRadius: BorderRadius.circular(20)), child: Text(cat.$1, style: TextStyle(color: cat.$2, fontWeight: FontWeight.w700, fontSize: 12))),
              const Spacer(),
              Text('Q${widget.index}', style: const TextStyle(color: Tokens.textSecondary, fontWeight: FontWeight.w600)),
              Icon(_open ? Icons.expand_less : Icons.expand_more, color: Tokens.textSecondary),
            ]),
            const SizedBox(height: 8),
            Text(q['question'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, height: 1.3)),
            if (_open) ...[
              const SizedBox(height: 12),
              const Text('How to answer', style: TextStyle(fontWeight: FontWeight.w700, color: Tokens.brand)),
              const SizedBox(height: 2),
              Text(q['tip'] as String? ?? '', style: const TextStyle(color: Tokens.textSecondary, height: 1.35)),
              const SizedBox(height: 12),
              const Text('From your profile', style: TextStyle(fontWeight: FontWeight.w700, color: Tokens.brand)),
              const SizedBox(height: 4),
              if (points.isEmpty)
                const Text('Nothing in your profile matches this one — answer from your own experience.', style: TextStyle(color: Tokens.textSecondary))
              else
                for (final p in points) Padding(padding: const EdgeInsets.only(bottom: 4), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [const Padding(padding: EdgeInsets.only(top: 2, right: 8), child: Icon(Icons.check_circle, size: 16, color: Tokens.success)), Expanded(child: Text(p, style: const TextStyle(height: 1.35)))])),
            ] else
              const Padding(padding: EdgeInsets.only(top: 4), child: Text('Tap for tips and talking points', style: TextStyle(color: Tokens.textSecondary, fontSize: 12))),
          ]),
        ),
      ),
    );
  }
}
