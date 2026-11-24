import 'package:flutter_test/flutter_test.dart';
import 'package:global_ai_resume_studio/features/profile/profile_data.dart';

void main() {
  test('liveList returns the same list, so edits made by cards are kept (regression: typed roles were lost)', () {
    final data = <String, dynamic>{'experience': [{'id': '1', 'title': '', 'employer': '', 'bullets': []}]};
    final a = liveList(data, 'experience');
    a[0]['title'] = 'Flutter Developer';
    a[0]['employer'] = 'Acme';
    final b = liveList(data, 'experience'); // what the next rebuild sees
    expect(identical(a, b), isTrue);
    expect(b[0]['title'], 'Flutter Developer');
    expect((data['experience'] as List).first['employer'], 'Acme'); // what Save sends
  });

  test('liveList creates a missing list and stays attached to the profile', () {
    final data = <String, dynamic>{};
    liveList(data, 'skills').add({'id': 's', 'name': 'Dart'});
    expect((data['skills'] as List).length, 1);
  });

  test('pruneBlankEntries removes untouched cards but keeps filled ones', () {
    final data = <String, dynamic>{
      'experience': [
        {'id': '1', 'title': '', 'employer': '  ', 'bullets': [{'id': 'b', 'text': ''}]},
        {'id': '2', 'title': 'Dev', 'employer': '', 'bullets': []},
      ],
      'education': [{'id': 'e', 'institution': '', 'qualification': ''}],
      'skills': [{'id': 's1', 'name': ''}, {'id': 's2', 'name': 'Flutter'}],
    };
    pruneBlankEntries(data);
    expect(liveList(data, 'experience').map((e) => e['id']), ['2']);
    expect(liveList(data, 'education'), isEmpty);
    expect(liveList(data, 'skills').map((e) => e['name']), ['Flutter']);
  });
}
