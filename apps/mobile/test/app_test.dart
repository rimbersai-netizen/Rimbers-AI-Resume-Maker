import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:global_ai_resume_studio/core/theme.dart';
import 'package:global_ai_resume_studio/core/widgets.dart';
import 'package:global_ai_resume_studio/core/jobs_api.dart';
import 'package:global_ai_resume_studio/features/auth/auth_screens.dart';
import 'package:global_ai_resume_studio/features/jobs/jobs_screen.dart';

Widget host(Widget child, {TextDirection dir = TextDirection.ltr}) =>
    MaterialApp(theme: buildTheme(), home: Directionality(textDirection: dir, child: Scaffold(body: child)));

void main() {
  jobsTests();
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

// ---- jobs + community (Phase 15)
void jobsTests() {
  group('jobs models', () {
    test('job feed JSON parses with match details', () {
      final j = Job.fromJson({
        'key': 'remotive:1', 'source': 'remotive', 'title': 'Engineer', 'company': 'Acme', 'location': 'Worldwide', 'url': 'https://x.test/1', 'description': 'Build.',
        'postedAt': '2026-11-24T00:00:00.000Z',
        'match': {'score': 82, 'label': 'strong', 'matched': [{'skill': 'react', 'label': 'React', 'required': true}], 'missing': [], 'profileYears': 5.5},
      });
      expect(j.match!.score, 82);
      expect(j.match!.labelText, 'Strong match');
      expect(j.match!.matched.single.label, 'React');
      expect(j.sourceName, 'Remotive');
    });
    test('preferences serialise exactly what the server validates', () {
      final p = JobPrefs(roles: ['engineer'], workModes: ['remote'], minSalary: 100000, postedWithinDays: 7);
      expect(p.toJson(), {'roles': ['engineer'], 'workModes': ['remote'], 'countries': <String>[], 'minSalary': 100000, 'postedWithinDays': 7});
    });
  });

  group('jobs widgets', () {
    testWidgets('match bar exposes an accessible estimated score', (t) async {
      final handle = t.ensureSemantics();
      final m = JobMatch(92, 'strong', [], [], null, 0);
      await t.pumpWidget(host(SizedBox(width: 300, child: MatchBar(m))));
      expect(find.bySemanticsLabel(RegExp('Estimated match 92 out of 100, Strong match')), findsOneWidget);
      handle.dispose();
    });
    test('label colours follow the match thresholds', () {
      expect(labelColor('strong'), Tokens.success);
      expect(labelColor('stretch'), Tokens.danger);
    });
  });
}
