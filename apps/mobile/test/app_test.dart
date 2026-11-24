import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:global_ai_resume_studio/core/theme.dart';
import 'package:global_ai_resume_studio/core/widgets.dart';
import 'package:global_ai_resume_studio/features/auth/auth_screens.dart';

Widget host(Widget child, {TextDirection dir = TextDirection.ltr}) =>
    MaterialApp(theme: buildTheme(), home: Directionality(textDirection: dir, child: Scaffold(body: child)));

void main() {
  group('auth validation', () {
    test('email', () {
      expect(validateEmail(''), 'Required');
      expect(validateEmail('nope'), 'Enter a valid email address');
      expect(validateEmail('a@b.co'), isNull);
    });
    test('password needs 8+ chars', () {
      expect(validatePassword('short'), isNotNull);
      expect(validatePassword('longenough'), isNull);
    });
    test('auth errors are friendly, never raw', () {
      expect(friendlyAuthError(Exception('Invalid login credentials')), contains('incorrect'));
      expect(friendlyAuthError(Exception('SocketException: Failed host lookup')), contains('Cannot reach'));
    });
  });

  group('widgets', () {
    testWidgets('score ring exposes an accessible estimated score', (t) async {
      final handle = t.ensureSemantics();
      await t.pumpWidget(host(const ScoreRing(score: 84)));
      expect(find.textContaining('84', findRichText: true), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp('Estimated score 84 out of 100')), findsOneWidget);
      handle.dispose();
    });

    test('score colours follow the design thresholds', () {
      expect(scoreColor(92), Tokens.success);
      expect(scoreColor(60), Tokens.warning);
      expect(scoreColor(20), Tokens.danger);
    });

    testWidgets('gradient button is disabled while busy', (t) async {
      var taps = 0;
      await t.pumpWidget(host(GradientButton(label: 'Go', busy: true, onPressed: () => taps++)));
      await t.tap(find.byType(GradientButton));
      expect(taps, 0);
    });

    testWidgets('gradient button fires and mirrors its arrow in RTL', (t) async {
      var taps = 0;
      await t.pumpWidget(host(GradientButton(label: 'Go', trailing: Icons.arrow_forward, onPressed: () => taps++), dir: TextDirection.rtl));
      await t.tap(find.text('Go'));
      expect(taps, 1);
      expect(find.byType(Transform), findsWidgets);
    });

    testWidgets('error banner offers retry and plans actions', (t) async {
      var retried = false, plans = false;
      await t.pumpWidget(host(ErrorBanner('Boom', onRetry: () => retried = true, onUpgrade: () => plans = true)));
      await t.tap(find.text('Try again'));
      await t.tap(find.text('See plans'));
      expect(retried && plans, isTrue);
    });
  });
}
