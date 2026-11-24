import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api.dart';

/// Country conventions from the backend (suggestions only — never forced on the user).
final countriesProvider = FutureProvider<List<Map<String, dynamic>>>((ref) => Api.instance.countries());

final templatesProvider = FutureProvider<Map<String, dynamic>>((ref) => Api.instance.templates());

final planProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) => Api.instance.plan());

/// Languages offered for resumes / letters (resume language is independent of the app language and of the country).
const resumeLanguages = <String, String>{
  'en': 'English', 'ar': 'العربية (Arabic)', 'ur': 'اردو (Urdu)', 'fr': 'Français', 'es': 'Español', 'de': 'Deutsch',
  'it': 'Italiano', 'pt': 'Português', 'tr': 'Türkçe', 'hi': 'हिन्दी (Hindi)', 'zh': '中文 (Chinese)', 'ja': '日本語 (Japanese)',
};

String prettyCategory(String slug) => slug.split('_').map((w) => w.isEmpty ? w : w[0].toUpperCase() + w.substring(1)).join(' ');
