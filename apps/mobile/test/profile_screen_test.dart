import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:global_ai_resume_studio/core/api.dart';
import 'package:global_ai_resume_studio/core/data.dart';
import 'package:global_ai_resume_studio/core/theme.dart';
import 'package:global_ai_resume_studio/features/profile/profile_screen.dart';

/// Mirrors what happened on the phone: add a role, type into it, save — the typed values must be in what Save sends.
Future<Map<String, dynamic>?> _run(WidgetTester t, Future<void> Function() steps, {required void Function(Map<String, dynamic>) onSave}) async {
  final p = LoadedProfile('id', '2026-01-01T00:00:00Z', {'personal': {'fullName': 'Aliza'}, 'experience': <dynamic>[], 'education': <dynamic>[], 'skills': <dynamic>[]});
  await t.pumpWidget(ProviderScope(
    overrides: [countriesProvider.overrideWith((ref) async => <Map<String, dynamic>>[])],
    child: MaterialApp(theme: buildTheme(), home: ProfileScreen(loader: () async => p, saver: (lp) async { onSave(jsonDecode(jsonEncode(lp.data)) as Map<String, dynamic>); return '2026-01-02T00:00:00Z'; })),
  ));
  await t.pumpAndSettle();
  await steps();
  return null;
}

Future<void> _tapSave(WidgetTester t) async {
  final b = find.text('Save & Continue');
  // The list is lazy: scroll the page (like a user) until the button exists.
  final page = find.descendant(of: find.byType(ListView).first, matching: find.byType(Scrollable)).first;
  await t.scrollUntilVisible(b, 300, scrollable: page);
  await t.pumpAndSettle();
  await t.tap(b);
  await t.pumpAndSettle();
}

void main() {
  testWidgets('a role typed into the form is saved (regression: typed roles were dropped)', (t) async {
    final saves = <Map<String, dynamic>>[];
    await _run(t, () async {
      await _tapSave(t); // step 1 (personal) -> experience
      expect(find.text('Work Experience'), findsOneWidget);
      final page = find.descendant(of: find.byType(ListView).first, matching: find.byType(Scrollable)).first;
      await t.scrollUntilVisible(find.text('Add experience'), 300, scrollable: page);
      await t.tap(find.text('Add experience'));
      await t.pumpAndSettle();
      await t.enterText(find.widgetWithText(TextFormField, 'Job title *'), 'Flutter Developer');
      await t.enterText(find.widgetWithText(TextFormField, 'Company *'), 'Acme');
      await t.pump();
      await t.enterText(find.widgetWithText(TextFormField, 'Location'), 'Islamabad'); // forces more rebuilds
      await t.pumpAndSettle();
      await _tapSave(t);
    }, onSave: saves.add);
    final exp = saves.last['experience'] as List;
    expect(exp, hasLength(1));
    expect(exp.single['title'], 'Flutter Developer');
    expect(exp.single['employer'], 'Acme');
    expect(exp.single['location'], 'Islamabad');
    expect(find.text('Education'), findsWidgets); // moved on to the next step
  });

  testWidgets('an empty role card does not block saving and is not sent', (t) async {
    final saves = <Map<String, dynamic>>[];
    await _run(t, () async {
      await _tapSave(t);
      final page = find.descendant(of: find.byType(ListView).first, matching: find.byType(Scrollable)).first;
      await t.scrollUntilVisible(find.text('Add experience'), 300, scrollable: page);
      await t.tap(find.text('Add experience'));
      await t.pumpAndSettle();
      await _tapSave(t);
    }, onSave: saves.add);
    expect(saves.last['experience'] as List, isEmpty);
    expect(find.text('Required'), findsNothing);
  });
}
