import 'package:flutter/foundation.dart';

/// Build-time configuration (`--dart-define=KEY=value`). Only public values live here:
/// the Supabase anon key is designed to be public (RLS protects data); service keys never ship in the app.
class Config {
  static const _supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
  static const _apiBase = String.fromEnvironment('API_BASE_URL');

  /// The Android emulator reaches the host machine at 10.0.2.2, not 127.0.0.1.
  /// Dev only: rewrite loopback URLs (e.g. signed storage links) so the Android emulator can reach the host.
  static String fixHost(String url) => _hostFix(url);

  static String _hostFix(String url) =>
      (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) ? url.replaceAll('127.0.0.1', '10.0.2.2') : url;

  static String get supabaseUrl => _hostFix(_supabaseUrl.isEmpty ? 'http://127.0.0.1:55421' : _supabaseUrl);
  static String get apiBase => _hostFix(_apiBase.isEmpty ? 'http://127.0.0.1:3100' : _apiBase);
  static bool get configured => supabaseAnonKey.isNotEmpty;
}
