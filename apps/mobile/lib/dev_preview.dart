// Developer-only visual preview (no sign-in or backend): `flutter run -t lib/dev_preview.dart`.
// Renders the real screens with fake data so the UI can be reviewed on a device/emulator. Not the shipped entry (main.dart).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'core/api.dart';
import 'core/data.dart';
import 'core/illustrations.dart';
import 'core/jobs_api.dart';
import 'core/theme.dart';
import 'features/home/shell.dart';
import 'features/jobs/jobs_screen.dart';
import 'features/profile/profile_screen.dart';
import 'features/resumes/editor_screen.dart';
import 'features/resumes/new_resume_screen.dart';

const _countries = [
  {'countryCode': 'US', 'name': 'United States', 'flag': '🇺🇸', 'documentName': 'resume', 'pageSize': 'Letter'},
  {'countryCode': 'GB', 'name': 'United Kingdom', 'flag': '🇬🇧', 'documentName': 'cv', 'pageSize': 'A4'},
  {'countryCode': 'PK', 'name': 'Pakistan', 'flag': '🇵🇰', 'documentName': 'cv', 'pageSize': 'A4'},
];

final _profile = LoadedProfile('p1', '2026-01-01T00:00:00Z', {
  'personal': {'fullName': 'Aliza Khan', 'professionalTitle': 'Senior Software Engineer', 'email': 'aliza@example.com', 'phone': '+1 (555) 123-4567', 'location': {'city': 'New York', 'country': 'US'}},
  'summary': 'Engineer with 6 years of experience building mobile apps.',
  'experience': [
    {'id': 'e1', 'employer': 'Acme Labs', 'title': 'Senior Flutter Developer', 'dates': {'start': '2021-03', 'current': true}, 'bullets': []},
  ],
  'education': [], 'skills': [], 'languages': [], 'certifications': [],
});

final _layout = <String, dynamic>{
  'title': 'Professional Resume', 'country': 'US', 'locale': 'en', 'templateId': 'classic', 'pageSize': 'Letter', 'includePhoto': false,
  'settings': {'overridden': <String>[]},
  'sections': [
    for (final k in ['summary', 'experience', 'education', 'skills', 'certifications', 'languages']) {'key': k, 'visible': k != 'languages'},
  ],
};

final _router = GoRouter(initialLocation: '/home', routes: [
  GoRoute(path: '/home', builder: (_, s) => AppShell(tab: int.tryParse(s.uri.queryParameters['tab'] ?? '') ?? 0)),
  GoRoute(path: '/resumes', builder: (_, __) => const ResumesScreen()),
  GoRoute(path: '/resumes/new', builder: (_, s) => NewResumeScreen(initialTemplate: s.uri.queryParameters['template'])),
  GoRoute(path: '/resumes/:id', builder: (_, s) => EditorScreen(resumeId: s.pathParameters['id']!, initialTab: int.tryParse(s.uri.queryParameters['tab'] ?? '') ?? 0, loader: (id) async => LoadedResume(id, '2026-01-01T00:00:00Z', _layout))),
  GoRoute(path: '/tools', builder: (_, __) => const ToolsScreen()),
  GoRoute(path: '/profile/edit', builder: (_, s) => ProfileScreen(initialStep: int.tryParse(s.uri.queryParameters['step'] ?? '') ?? 0, loader: () async => _profile, saver: (p) async => p.updatedAt)),
  GoRoute(path: '/:rest(.*)', builder: (_, s) => Scaffold(appBar: AppBar(title: Text(s.uri.path)), body: const Center(child: Text('Not part of the preview')))),
]);

void main() {
  debugProfileLoader = () async => _profile;
  runApp(ProviderScope(
      overrides: [
        countriesProvider.overrideWith((ref) async => _countries.map((e) => Map<String, dynamic>.from(e)).toList()),
        templatesProvider.overrideWith((ref) async => {'categories': <String>[], 'templates': <Map<String, dynamic>>[]}),
        resumesProvider.overrideWith((ref) async => [
              ResumeSummary('r1', 'Professional Resume', 'US', 'en', 'classic', DateTime.now().subtract(const Duration(hours: 2))),
              ResumeSummary('r2', 'Product Designer CV', 'GB', 'en', 'modern', DateTime.now().subtract(const Duration(days: 3))),
            ]),
        profileProvider.overrideWith((ref) async => _profile),
        planProvider.overrideWith((ref) async => {'plan': 'FREE'}),
        pipelineProvider.overrideWith((ref, s) async => (items: <PipelineItem>[], counts: <String, int>{})),
      ],
      child: MaterialApp.router(
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        routerConfig: _router,
        builder: (context, child) => AppBackground(child: child ?? const SizedBox.shrink()),
      ),
    ));
}
