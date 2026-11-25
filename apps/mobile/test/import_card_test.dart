import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:global_ai_resume_studio/core/api.dart';
import 'package:global_ai_resume_studio/core/theme.dart';
import 'package:global_ai_resume_studio/features/resumes/import_card.dart';

Widget _host(ImportResumeCard c) => MaterialApp(theme: buildTheme(), home: Scaffold(body: SingleChildScrollView(child: c)));

const _output = {
  'kind': 'imported_profile',
  'dropped': 2,
  'counts': {'experience': 2, 'education': 1, 'skills': 5, 'certifications': 0, 'languages': 2, 'projects': 0},
  'profile': {'personal': {'fullName': 'Maria Gonzalez'}},
};

void main() {
  testWidgets('upload → progress → review summary → use → imported', (t) async {
    var applied = false, imported = false;
    var polls = 0;
    await t.pumpWidget(_host(ImportResumeCard(
      pollEvery: const Duration(milliseconds: 10),
      pick: () async => (name: 'cv.pdf', bytes: [1, 2, 3]),
      upload: (n, b) async { expect(n, 'cv.pdf'); return 'job-1'; },
      poll: (id) async => ++polls < 2 ? {'status': 'running'} : {'status': 'succeeded', 'output': _output},
      profileHasData: () async => false,
      apply: (id) async { expect(id, 'job-1'); applied = true; },
      onImported: () => imported = true,
    )));
    expect(find.text('Import your existing resume'), findsOneWidget);
    await t.tap(find.text('Upload PDF or Word file'));
    await t.pump();
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    await t.pump(const Duration(milliseconds: 50));
    await t.pump(const Duration(milliseconds: 50));
    expect(find.text('Found in your resume'), findsOneWidget);
    expect(find.textContaining('Maria Gonzalez'), findsOneWidget);
    expect(find.textContaining('2 jobs'), findsOneWidget);
    expect(find.textContaining('left out'), findsOneWidget);
    await t.tap(find.text('Use these details'));
    await t.pumpAndSettle();
    expect(applied, isTrue);
    expect(imported, isTrue);
    expect(find.text('Resume imported'), findsOneWidget);
  });

  testWidgets('asks before replacing an existing profile', (t) async {
    var applied = false;
    await t.pumpWidget(_host(ImportResumeCard(
      pollEvery: const Duration(milliseconds: 10),
      pick: () async => (name: 'cv.docx', bytes: [1]),
      upload: (n, b) async => 'j',
      poll: (id) async => {'status': 'succeeded', 'output': _output},
      profileHasData: () async => true,
      apply: (id) async => applied = true,
    )));
    await t.tap(find.text('Upload PDF or Word file'));
    await t.pump(); await t.pump(const Duration(milliseconds: 30));
    await t.tap(find.text('Use these details'));
    await t.pumpAndSettle();
    expect(find.text('Replace your profile details?'), findsOneWidget);
    await t.tap(find.text('Cancel'));
    await t.pumpAndSettle();
    expect(applied, isFalse);
    await t.tap(find.text('Use these details'));
    await t.pumpAndSettle();
    await t.tap(find.text('Replace'));
    await t.pumpAndSettle();
    expect(applied, isTrue);
  });

  testWidgets('shows the server message when the file cannot be read, and lets the user retry', (t) async {
    await t.pumpWidget(_host(ImportResumeCard(
      pick: () async => (name: 'scan.pdf', bytes: [1]),
      upload: (n, b) async => throw ApiException("We couldn't read any text in that file."),
    )));
    await t.tap(find.text('Upload PDF or Word file'));
    await t.pumpAndSettle();
    expect(find.textContaining("couldn't read any text"), findsOneWidget);
    expect(find.text('Upload PDF or Word file'), findsOneWidget);
  });

  testWidgets('a failed AI job shows its message', (t) async {
    await t.pumpWidget(_host(ImportResumeCard(
      pollEvery: const Duration(milliseconds: 10),
      pick: () async => (name: 'cv.pdf', bytes: [1]),
      upload: (n, b) async => 'j',
      poll: (id) async => {'status': 'failed', 'message': 'The AI assistant took too long to respond. Please try again.'},
    )));
    await t.tap(find.text('Upload PDF or Word file'));
    await t.pump(); await t.pump(const Duration(milliseconds: 30));
    expect(find.textContaining('took too long'), findsOneWidget);
  });

  testWidgets('cancelling the picker changes nothing', (t) async {
    await t.pumpWidget(_host(ImportResumeCard(pick: () async => null)));
    await t.tap(find.text('Upload PDF or Word file'));
    await t.pumpAndSettle();
    expect(find.text('Upload PDF or Word file'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsNothing);
  });
}
