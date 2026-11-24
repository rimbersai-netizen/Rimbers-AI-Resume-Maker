import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'api.dart';
import 'theme.dart';

class GradientButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final IconData? trailing;
  final IconData? leading;
  final bool busy;
  const GradientButton({super.key, required this.label, this.onPressed, this.trailing, this.leading, this.busy = false});

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !busy;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return Opacity(
      opacity: enabled ? 1 : 0.55,
      child: Material(
        color: Colors.transparent,
        child: Ink(
          decoration: BoxDecoration(gradient: Tokens.gradient, borderRadius: BorderRadius.circular(Tokens.rButton)),
          child: InkWell(
            borderRadius: BorderRadius.circular(Tokens.rButton),
            onTap: enabled ? onPressed : null,
            child: Container(
              height: 56, alignment: Alignment.center, padding: const EdgeInsets.symmetric(horizontal: 20),
              child: busy
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                  : Row(mainAxisSize: MainAxisSize.min, children: [
                      if (leading != null) ...[Icon(leading, color: Colors.white, size: 20), const SizedBox(width: 8)],
                      Flexible(child: Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 16), overflow: TextOverflow.ellipsis)),
                      if (trailing != null) ...[const SizedBox(width: 8), Transform.flip(flipX: rtl, child: Icon(trailing, color: Colors.white, size: 20))],
                    ]),
            ),
          ),
        ),
      ),
    );
  }
}

class OutlineButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  const OutlineButton({super.key, required this.label, this.onPressed, this.icon});
  @override
  Widget build(BuildContext context) => SizedBox(
        height: 52,
        child: OutlinedButton.icon(
          onPressed: onPressed,
          icon: icon == null ? const SizedBox.shrink() : Icon(icon, size: 20),
          label: Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
          style: OutlinedButton.styleFrom(
            foregroundColor: Tokens.brand, side: const BorderSide(color: Tokens.border), backgroundColor: Tokens.surface,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Tokens.rButton))),
        ),
      );
}

class Section extends StatelessWidget {
  final String title;
  final Widget? action;
  final List<Widget> children;
  const Section({super.key, required this.title, this.action, required this.children});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 24),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Expanded(child: Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700))), if (action != null) action!]),
          const SizedBox(height: 12),
          ...children,
        ]),
      );
}

class ErrorBanner extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;
  final VoidCallback? onUpgrade;
  const ErrorBanner(this.message, {super.key, this.onRetry, this.onUpgrade});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: const Color(0xFFFDECEC), borderRadius: BorderRadius.circular(Tokens.rInput), border: Border.all(color: const Color(0xFFF6C9CB))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Icon(Icons.error_outline, color: Tokens.danger, size: 20),
            const SizedBox(width: 10),
            Expanded(child: Text(message, style: const TextStyle(color: Color(0xFF8A1F24)))),
          ]),
          if (onRetry != null || onUpgrade != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Wrap(spacing: 8, children: [
                if (onRetry != null) TextButton(onPressed: onRetry, child: const Text('Try again')),
                if (onUpgrade != null) TextButton(onPressed: onUpgrade, child: const Text('See plans')),
              ]),
            ),
        ]),
      );
}

class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String body;
  final Widget? action;
  const EmptyState({super.key, required this.icon, required this.title, required this.body, this.action});
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 72, height: 72, decoration: const BoxDecoration(color: Tokens.subtle, shape: BoxShape.circle), child: Icon(icon, color: Tokens.brand, size: 32)),
            const SizedBox(height: 16),
            Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700), textAlign: TextAlign.center),
            const SizedBox(height: 6),
            Text(body, style: const TextStyle(color: Tokens.textSecondary), textAlign: TextAlign.center),
            if (action != null) ...[const SizedBox(height: 16), action!],
          ]),
        ),
      );
}

class Loading extends StatelessWidget {
  final String? label;
  const Loading({super.key, this.label});
  @override
  Widget build(BuildContext context) => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const CircularProgressIndicator(color: Tokens.brand),
          if (label != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(label!, style: const TextStyle(color: Tokens.textSecondary))),
        ]),
      );
}

void toast(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}

Future<bool> confirm(BuildContext context, {required String title, required String body, String action = 'Delete', bool danger = true}) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text(title),
      content: Text(body),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
        TextButton(onPressed: () => Navigator.pop(c, true), child: Text(action, style: TextStyle(color: danger ? Tokens.danger : Tokens.brand))),
      ],
    ),
  );
  return r ?? false;
}

Color scoreColor(num score) => score >= 80 ? Tokens.success : (score >= 50 ? Tokens.warning : Tokens.danger);

/// Circular score gauge. Never mirrored in RTL (per design system).
class ScoreRing extends StatelessWidget {
  final int score;
  final double size;
  const ScoreRing({super.key, required this.score, this.size = 120});
  @override
  Widget build(BuildContext context) => Semantics(
        label: 'Estimated score $score out of 100',
        child: SizedBox(
          width: size, height: size,
          child: CustomPaint(
            painter: _RingPainter(score / 100, scoreColor(score)),
            child: Center(child: Text.rich(TextSpan(children: [
              TextSpan(text: '$score', style: TextStyle(fontSize: size * 0.3, fontWeight: FontWeight.w800)),
              TextSpan(text: '/100', style: TextStyle(fontSize: size * 0.11, color: Tokens.textSecondary)),
            ]))),
          ),
        ),
      );
}

class _RingPainter extends CustomPainter {
  final double value;
  final Color color;
  _RingPainter(this.value, this.color);
  @override
  void paint(Canvas canvas, Size size) {
    final stroke = size.width * 0.09;
    final rect = Offset(stroke / 2, stroke / 2) & Size(size.width - stroke, size.height - stroke);
    final track = Paint()..style = PaintingStyle.stroke..strokeWidth = stroke..color = Tokens.subtle;
    final arc = Paint()..style = PaintingStyle.stroke..strokeWidth = stroke..strokeCap = StrokeCap.round..color = color;
    canvas.drawArc(rect, 0, math.pi * 2, false, track);
    canvas.drawArc(rect, -math.pi / 2, math.pi * 2 * value.clamp(0, 1), false, arc);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.value != value || old.color != color;
}

/// Runs one AI job: queue → poll → ready/error, cancelling a queued job on dispose/reset.
class AiRunner extends ChangeNotifier {
  AiRunner();
  String state = 'idle'; // idle | working | ready | error
  Map<String, dynamic>? output;
  String? error;
  bool upgrade = false;
  DateTime? startedAt;
  String? _jobId;
  Timer? _timer;
  bool _disposed = false;

  Future<void> start(Map<String, dynamic> input) async {
    reset(notify: false);
    state = 'working';
    startedAt = DateTime.now();
    notifyListeners();
    try {
      _jobId = await Api.instance.requestAi(input);
    } on ApiException catch (e) {
      return _fail(e.message, upgrade: e.upgrade);
    }
    _poll();
  }

  void _poll() {
    _timer = Timer(const Duration(milliseconds: 1500), () async {
      final id = _jobId;
      if (id == null || _disposed) return;
      try {
        final s = await Api.instance.aiJob(id);
        switch (s['status']) {
          case 'succeeded':
            output = Map<String, dynamic>.from(s['output'] as Map);
            state = 'ready';
            _jobId = null;
            return notifyListeners();
          case 'failed':
          case 'cancelled':
            return _fail((s['message'] as String?) ?? 'The AI assistant could not finish.');
        }
      } on ApiException catch (e) {
        return _fail(e.message);
      }
      if (DateTime.now().difference(startedAt!) > const Duration(minutes: 4)) {
        Api.instance.cancelAi(id);
        return _fail('The AI assistant is temporarily unavailable. Your data is safe — try again later.');
      }
      _poll();
    });
  }

  void _fail(String message, {bool upgrade = false}) {
    if (_disposed) return;
    error = message;
    this.upgrade = upgrade;
    state = 'error';
    _jobId = null;
    notifyListeners();
  }

  void reset({bool notify = true}) {
    _timer?.cancel();
    final id = _jobId;
    if (id != null) Api.instance.cancelAi(id);
    _jobId = null;
    state = 'idle';
    output = null;
    error = null;
    upgrade = false;
    if (notify && !_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    final id = _jobId;
    if (id != null) Api.instance.cancelAi(id);
    super.dispose();
  }
}

/// Shows progress / result / error for an [AiRunner]. `resultBuilder` renders the editable suggestion.
class AiPanel extends StatelessWidget {
  final AiRunner runner;
  final VoidCallback onRetry;
  final VoidCallback onSeePlans;
  final Widget Function(BuildContext, Map<String, dynamic>) resultBuilder;
  const AiPanel({super.key, required this.runner, required this.onRetry, required this.onSeePlans, required this.resultBuilder});
  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: runner,
        builder: (context, _) {
          switch (runner.state) {
            case 'working':
              return _Working(since: runner.startedAt!, onCancel: runner.reset);
            case 'ready':
              final out = runner.output!;
              final review = ((out['violations'] as List?) ?? []).cast<Map>().where((v) => v['severity'] == 'review').map((v) => '${v['value']}').toList();
              return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                resultBuilder(context, out),
                if (review.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: ErrorBanner('Please confirm these are true before accepting: ${review.join(', ')}')),
                const Padding(padding: EdgeInsets.only(top: 8), child: Text('AI can make mistakes. It only uses your profile — check every detail is accurate before accepting.', style: TextStyle(color: Tokens.textSecondary, fontSize: 12))),
              ]);
            case 'error':
              return ErrorBanner(runner.error ?? 'Something went wrong.', onRetry: runner.upgrade ? null : onRetry, onUpgrade: runner.upgrade ? onSeePlans : null);
            default:
              return const SizedBox.shrink();
          }
        },
      );
}

class _Working extends StatefulWidget {
  final DateTime since;
  final VoidCallback onCancel;
  const _Working({required this.since, required this.onCancel});
  @override
  State<_Working> createState() => _WorkingState();
}

class _WorkingState extends State<_Working> {
  Timer? _t;
  @override
  void initState() {
    super.initState();
    _t = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _t?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = DateTime.now().difference(widget.since).inSeconds;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(children: [
          const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Tokens.brand)),
          const SizedBox(width: 12),
          Expanded(child: Text('Writing with the private on-device AI… ${s}s\n(usually under a minute)', style: const TextStyle(color: Tokens.textSecondary))),
          TextButton(onPressed: widget.onCancel, child: const Text('Cancel')),
        ]),
      ),
    );
  }
}
