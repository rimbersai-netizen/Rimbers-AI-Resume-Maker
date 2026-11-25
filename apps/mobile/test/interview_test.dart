import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:global_ai_resume_studio/core/data.dart';
import 'package:global_ai_resume_studio/core/theme.dart';
import 'package:global_ai_resume_studio/features/interview/interview_screen.dart';

Widget _app(Map<String, dynamic> plan) => ProviderScope(
      overrides: [planProvider.overrideWith((ref) async => plan)],
      child: MaterialApp(theme: buildTheme(), home: const InterviewPrepScreen()),
    );

void main() {
  testWidgets('Free/Standard users see the Pro lock, not the form', (t) async {
    await t.pumpWidget(_app({'plan': 'FREE', 'interviewPrep': false}));
    await t.pumpAndSettle();
    expect(find.text('Interview Prep is a Pro feature'), findsOneWidget);
    expect(find.text('See plans'), findsOneWidget);
    expect(find.text('Generate questions'), findsNothing);
    expect(find.textContaining('Role you are interviewing for'), findsNothing);
  });

  testWidgets('Professional users get the form and need a role before generating', (t) async {
    await t.pumpWidget(_app({'plan': 'PROFESSIONAL', 'interviewPrep': true}));
    await t.pumpAndSettle();
    expect(find.text('Interview Prep is a Pro feature'), findsNothing);
    expect(find.textContaining('Role you are interviewing for'), findsOneWidget);
    await t.tap(find.text('Generate questions'));
    await t.pumpAndSettle();
    expect(find.text('Enter the role you are interviewing for.'), findsOneWidget);
  });

  testWidgets('results show category, expandable tips and profile-only talking points, plus honest gaps', (t) async {
    await t.pumpWidget(MaterialApp(
      theme: buildTheme(),
      home: Scaffold(
        body: SingleChildScrollView(
          child: InterviewResults(output: const {
            'gaps': ['kubernetes'],
            'questions': [
              {'question': 'Tell me about a project you are proud of.', 'category': 'behavioral', 'tip': 'Use situation, task, action, result.', 'talkingPoints': ['Built the checkout flow at Acme Labs']},
              {'question': 'How do you test a Flutter app?', 'category': 'technical', 'tip': 'Mention unit and widget tests.', 'talkingPoints': []},
            ],
          }),
        ),
      ),
    ));
    expect(find.text('Be ready to discuss'), findsOneWidget);
    expect(find.textContaining('kubernetes'), findsOneWidget);
    expect(find.text('Behavioral'), findsOneWidget);
    expect(find.text('Technical'), findsOneWidget);
    expect(find.text('Use situation, task, action, result.'), findsNothing); // collapsed
    await t.tap(find.text('Tell me about a project you are proud of.'));
    await t.pumpAndSettle();
    expect(find.text('Use situation, task, action, result.'), findsOneWidget);
    expect(find.text('Built the checkout flow at Acme Labs'), findsOneWidget);
    await t.tap(find.text('How do you test a Flutter app?'));
    await t.pumpAndSettle();
    expect(find.textContaining('Nothing in your profile matches'), findsOneWidget);
  });
}
