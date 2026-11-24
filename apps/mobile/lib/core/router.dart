import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../features/ai/ai_writer_screen.dart';
import '../features/ats/ats_screen.dart';
import '../features/auth/auth_screens.dart';
import '../features/cover_letters/cover_letter_screens.dart';
import '../features/community/community_screens.dart';
import '../features/home/shell.dart';
import '../features/jobs/preferences_screen.dart';
import '../features/jobs/tailor_screen.dart';
import '../features/linkedin/linkedin_screen.dart';
import '../features/onboarding/onboarding_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/resumes/editor_screen.dart';
import '../features/resumes/new_resume_screen.dart';
import '../features/settings/plans_screen.dart';
import '../features/settings/settings_screen.dart';

final prefsProvider = Provider<SharedPreferences>((_) => throw UnimplementedError('prefs not initialised'));

const _publicPaths = {'/onboarding', '/sign-in', '/sign-up', '/forgot-password'};

class _AuthRefresh extends ChangeNotifier {
  late final StreamSubscription<AuthState> _sub;
  _AuthRefresh() {
    _sub = Supabase.instance.client.auth.onAuthStateChange.listen((_) => notifyListeners());
  }
  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final prefs = ref.watch(prefsProvider);
  final refresh = _AuthRefresh();
  ref.onDispose(refresh.dispose);
  return GoRouter(
    initialLocation: '/home',
    refreshListenable: refresh,
    redirect: (context, state) {
      final loggedIn = Supabase.instance.client.auth.currentSession != null;
      final onboarded = prefs.getBool('onboarded') ?? false;
      final path = state.matchedLocation;
      if (!loggedIn) {
        if (!onboarded && path != '/onboarding') return '/onboarding';
        if (onboarded && !_publicPaths.contains(path)) return '/sign-in';
        return null;
      }
      if (_publicPaths.contains(path)) return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/onboarding', builder: (_, __) => const OnboardingScreen()),
      GoRoute(path: '/sign-in', builder: (_, __) => const SignInScreen()),
      GoRoute(path: '/sign-up', builder: (_, __) => const SignUpScreen()),
      GoRoute(path: '/forgot-password', builder: (_, __) => const ForgotPasswordScreen()),
      GoRoute(path: '/home', builder: (_, state) => AppShell(tab: int.tryParse(state.uri.queryParameters['tab'] ?? '') ?? 0)),
      GoRoute(path: '/resumes', builder: (_, __) => const ResumesScreen()),
      GoRoute(path: '/resumes/new', builder: (_, s) => NewResumeScreen(initialTemplate: s.uri.queryParameters['template'])),
      GoRoute(path: '/community', builder: (_, __) => Scaffold(appBar: AppBar(), body: const CommunityTab())),
      GoRoute(path: '/resumes/:id', builder: (_, s) => EditorScreen(resumeId: s.pathParameters['id']!, initialTab: int.tryParse(s.uri.queryParameters['tab'] ?? '') ?? 0)),
      GoRoute(path: '/resumes/:id/ats', builder: (_, s) => AtsScreen(resumeId: s.pathParameters['id']!)),
      GoRoute(path: '/profile/edit', builder: (_, s) => ProfileScreen(initialStep: int.tryParse(s.uri.queryParameters['step'] ?? '') ?? 0)),
      GoRoute(path: '/ai-writer', builder: (_, __) => const AiWriterScreen()),
      GoRoute(path: '/cover-letters', builder: (_, __) => const CoverLettersScreen()),
      GoRoute(path: '/cover-letters/new', builder: (_, __) => const NewCoverLetterScreen()),
      GoRoute(path: '/cover-letters/:id', builder: (_, s) => CoverLetterEditorScreen(id: s.pathParameters['id']!)),
      GoRoute(path: '/linkedin', builder: (_, __) => const LinkedInScreen()),
      GoRoute(path: '/jobs/preferences', builder: (_, __) => const JobPreferencesScreen()),
      GoRoute(path: '/jobs/tailor', builder: (_, s) => TailorScreen(jobKey: s.uri.queryParameters['key'] ?? '')),
      GoRoute(path: '/community/new', builder: (_, __) => const NewPostScreen()),
      GoRoute(path: '/community/:id', builder: (_, s) => PostScreen(id: s.pathParameters['id']!)),
      GoRoute(path: '/tools', builder: (_, __) => const ToolsScreen()),
      GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
      GoRoute(path: '/plans', builder: (_, __) => const PlansScreen()),
    ],
    errorBuilder: (_, s) => Scaffold(appBar: AppBar(), body: Center(child: Text('Page not found: ${s.uri}'))),
  );
});
