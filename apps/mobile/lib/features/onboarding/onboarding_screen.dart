import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/brand.dart';
import '../../core/illustrations.dart';
import '../../core/router.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});
  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingState();
}

class _OnboardingState extends ConsumerState<OnboardingScreen> {
  final _controller = PageController();
  int _page = 0;

  static const _pages = [
    (Icons.description_outlined, 'Create Professional Resumes in Seconds', 'Let AI craft your perfect resume with modern templates, ATS analysis and job matching.'),
    (Icons.public, 'Made for your country', 'CV conventions for 30 countries — page size, photo and section order — always your choice to change.'),
    (Icons.shield_outlined, 'AI that never invents facts', 'Suggestions use only what you entered. You accept, edit or reject every change.'),
    (Icons.ios_share, 'Export anywhere', 'Download PDF or editable Word files and share them straight from your phone.'),
  ];

  Future<void> _done() async {
    await ref.read(prefsProvider).setBool('onboarded', true);
    if (mounted) context.go('/sign-in');
  }

  @override
  Widget build(BuildContext context) {
    final last = _page == _pages.length - 1;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(Tokens.gutter),
          child: Column(children: [
            Align(alignment: AlignmentDirectional.centerEnd, child: TextButton(onPressed: _done, child: const Text('Skip'))),
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: _pages.length,
                onPageChanged: (i) => setState(() => _page = i),
                itemBuilder: (_, i) {
                  final p = _pages[i];
                  return Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    i == 0
                        ? const Column(mainAxisSize: MainAxisSize.min, children: [RimbersLogo(size: 76, stacked: true), SizedBox(height: 8), Text('Build a Better Career with AI', style: TextStyle(fontStyle: FontStyle.italic, fontSize: 17, color: Tokens.navy)), SizedBox(height: 12), ResumeIllustration(size: 250)])
                        : i == 1 ? const ResumeIllustration(size: 250) : Container(width: 200, height: 200, decoration: BoxDecoration(gradient: Tokens.gradient, shape: BoxShape.circle, boxShadow: Tokens.shadow), child: Icon(p.$1, color: Colors.white, size: 92)),
                    const SizedBox(height: 40),
                    Text(p.$2, textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 12),
                    Text(p.$3, textAlign: TextAlign.center, style: const TextStyle(color: Tokens.textSecondary, fontSize: 15, height: 1.45)),
                  ]);
                },
              ),
            ),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              for (var i = 0; i < _pages.length; i++)
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200), margin: const EdgeInsets.all(4), width: i == _page ? 22 : 8, height: 8,
                  decoration: BoxDecoration(color: i == _page ? Tokens.brand : Tokens.border, borderRadius: BorderRadius.circular(8))),
            ]),
            const SizedBox(height: 20),
            GradientButton(
              label: last || _page == 0 && false ? 'Get Started' : (_page == 0 ? 'Get Started' : 'Next'), trailing: Icons.arrow_forward,
              onPressed: () => last ? _done() : _controller.nextPage(duration: const Duration(milliseconds: 250), curve: Curves.easeOut)),
          ]),
        ),
      ),
    );
  }
}
