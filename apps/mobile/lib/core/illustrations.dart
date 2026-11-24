import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'theme.dart';

/// Soft light-blue canvas with large blurred "wave" blobs, as in the Rimbers mockups. Wraps the whole app.
class AppBackground extends StatelessWidget {
  final Widget child;
  const AppBackground({super.key, required this.child});

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFF6F9FF), Color(0xFFE6EFFF)])),
        child: Stack(children: [
          Positioned(top: -140, right: -120, child: _blob(360, const [Color(0x553B82FF), Color(0x003B82FF)])),
          Positioned(top: 220, left: -170, child: _blob(320, const [Color(0x331F5FE0), Color(0x001F5FE0)])),
          Positioned(bottom: -160, right: -100, child: _blob(380, const [Color(0x441F5FE0), Color(0x001F5FE0)])),
          Positioned.fill(child: child),
        ]),
      );

  Widget _blob(double size, List<Color> colors) => IgnorePointer(child: Container(width: size, height: size, decoration: BoxDecoration(shape: BoxShape.circle, gradient: RadialGradient(colors: colors))));
}

/// Tilted resume sheet inside an orbit ring with sparkles (welcome / onboarding art).
class ResumeIllustration extends StatelessWidget {
  final double size;
  const ResumeIllustration({super.key, this.size = 240});

  @override
  Widget build(BuildContext context) => Semantics(
        label: 'Illustration of a resume',
        excludeSemantics: true,
        child: SizedBox(
          width: size, height: size,
          child: Stack(alignment: Alignment.center, children: [
            CustomPaint(size: Size(size, size), painter: _OrbitPainter()),
            Transform.rotate(
              angle: -0.2,
              child: Container(
                width: size * .56, height: size * .7, padding: EdgeInsets.all(size * .05),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), boxShadow: [BoxShadow(color: Tokens.navy.withOpacity(.18), blurRadius: 26, offset: const Offset(0, 14))]),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('RESUME', style: TextStyle(color: Tokens.brand, fontWeight: FontWeight.w900, fontSize: size * .06, letterSpacing: 1)),
                  SizedBox(height: size * .03),
                  Row(children: [
                    CircleAvatar(radius: size * .05, backgroundColor: Tokens.subtle, child: Icon(Icons.person, color: Tokens.brand, size: size * .06)),
                    SizedBox(width: size * .03),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_line(size, .22, Tokens.brand), _line(size, .16, const Color(0xFFD5DCEB))])),
                  ]),
                  SizedBox(height: size * .03),
                  for (var i = 0; i < 6; i++) _line(size, i.isEven ? .4 : .32, const Color(0xFFD5DCEB)),
                ]),
              ),
            ),
            Positioned(top: size * .06, left: size * .1, child: Icon(Icons.auto_awesome, color: Tokens.gradientB, size: size * .11)),
            Positioned(bottom: size * .12, right: size * .06, child: Icon(Icons.auto_awesome, color: Tokens.brand, size: size * .09)),
          ]),
        ),
      );

  Widget _line(double size, double w, Color c) => Container(width: size * w, height: size * .022, margin: EdgeInsets.only(bottom: size * .02), decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(4)));
}

class _OrbitPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size s) {
    canvas.save();
    canvas.translate(s.width / 2, s.height / 2);
    canvas.rotate(-0.45);
    final rect = Rect.fromCenter(center: Offset.zero, width: s.width * .98, height: s.height * .42);
    canvas.drawOval(rect, Paint()..style = PaintingStyle.stroke..strokeWidth = 5..shader = Tokens.gradient.createShader(rect));
    canvas.restore();
  }

  @override
  bool shouldRepaint(_OrbitPainter old) => false;
}

/// Friendly AI mascot used on the home banner.
class RobotMascot extends StatelessWidget {
  final double size;
  const RobotMascot({super.key, this.size = 92});

  @override
  Widget build(BuildContext context) => Semantics(
        label: 'AI assistant',
        excludeSemantics: true,
        child: SizedBox(
          width: size, height: size,
          child: Stack(alignment: Alignment.center, children: [
            Positioned(top: 0, child: Container(width: size * .08, height: size * .16, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(4)))),
            Positioned(top: size * .12, child: Container(
              width: size * .82, height: size * .62,
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(size * .28), boxShadow: [BoxShadow(color: Colors.black.withOpacity(.2), blurRadius: 14, offset: const Offset(0, 8))]),
              alignment: Alignment.center,
              child: Container(
                width: size * .64, height: size * .4,
                decoration: BoxDecoration(color: const Color(0xFF0B2A7A), borderRadius: BorderRadius.circular(size * .2)),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  for (var i = 0; i < 2; i++) Container(width: size * .1, height: size * .13, margin: EdgeInsets.symmetric(horizontal: size * .05), decoration: BoxDecoration(color: const Color(0xFF55C2FF), borderRadius: BorderRadius.circular(size * .06))),
                ]),
              ),
            )),
            Positioned(bottom: 0, child: Transform.rotate(angle: math.pi / 18, child: Container(width: size * .5, height: size * .2, decoration: BoxDecoration(color: Colors.white.withOpacity(.9), borderRadius: BorderRadius.circular(size * .1))))),
          ]),
        ),
      );
}
