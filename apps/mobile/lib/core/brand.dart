import 'package:flutter/material.dart';
import 'theme.dart';

/// The Rimbers ribbon-"R" mark (assets/brand/r_logo.png, transparent) + wordmark.
class RimbersLogo extends StatelessWidget {
  final double size;
  final bool stacked; // mark above wordmark + tagline
  final bool onDark;
  const RimbersLogo({super.key, this.size = 32, this.stacked = false, this.onDark = false});

  @override
  Widget build(BuildContext context) {
    // The mark is 768×569 (with its sparkle). Stacked: big mark; inline: sized like the cap height of the wordmark.
    final h = stacked ? size * 1.5 : size * 1.05;
    Widget mark = Image.asset('assets/brand/r_logo.png', height: h, fit: BoxFit.contain, semanticLabel: 'Rimbers logo', filterQuality: FilterQuality.high);
    if (onDark) mark = ColorFiltered(colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn), child: mark);
    final color = onDark ? Colors.white : Tokens.navy;
    if (stacked) {
      return Semantics(
        label: 'Rimbers AI Resume Maker',
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          mark,
          Text('Rimbers', style: TextStyle(fontSize: size * .75, fontWeight: FontWeight.w800, color: color, height: 1.1)),
          Text('AI Resume Maker', style: TextStyle(fontSize: size * .34, fontWeight: FontWeight.w600, color: onDark ? Colors.white70 : Tokens.brand)),
        ]),
      );
    }
    return Semantics(
      label: 'Rimbers',
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        mark,
        const SizedBox(width: 6),
        Text('Rimbers', style: TextStyle(fontSize: size * .72, fontWeight: FontWeight.w800, color: color)),
      ]),
    );
  }
}

/// Mini paper preview used for template cards (no template images are shipped; this is a stylised stand-in).
class TemplateThumb extends StatelessWidget {
  final String category;
  final bool selected;
  const TemplateThumb({super.key, required this.category, this.selected = false});

  @override
  Widget build(BuildContext context) {
    final hue = category.codeUnits.fold<int>(0, (a, b) => a + b) % 5;
    final accent = [Tokens.brand, const Color(0xFF0E7490), const Color(0xFF334155), const Color(0xFF6D28D9), const Color(0xFF047857)][hue];
    final sidebar = hue % 2 == 0;
    Widget line(double w, {double h = 4, Color? c}) => Container(width: w, height: h, margin: const EdgeInsets.only(bottom: 4), decoration: BoxDecoration(color: c ?? const Color(0xFFD5DCEB), borderRadius: BorderRadius.circular(2)));
    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: selected ? Tokens.brand : Tokens.border, width: selected ? 2.5 : 1), boxShadow: Tokens.shadow),
      padding: const EdgeInsets.all(10),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (sidebar) Container(width: 22, decoration: BoxDecoration(color: accent.withOpacity(.14), borderRadius: BorderRadius.circular(4)), margin: const EdgeInsets.only(right: 8)),
        Expanded(
          child: LayoutBuilder(builder: (_, c) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [Container(width: 16, height: 16, decoration: BoxDecoration(color: accent.withOpacity(.25), shape: BoxShape.circle)), const SizedBox(width: 6), line(c.maxWidth * .5, h: 6, c: accent)]),
            const SizedBox(height: 6),
            for (var i = 0; i < 2; i++) ...[line(c.maxWidth * .35, c: accent.withOpacity(.6)), line(c.maxWidth), line(c.maxWidth * .9), line(c.maxWidth * .7), const SizedBox(height: 4)],
          ])),
        ),
      ]),
    );
  }
}
