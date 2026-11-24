import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'config.dart';

class ApiException implements Exception {
  final String message;
  final int status;
  final bool upgrade;
  final Map<String, String> issues;
  ApiException(this.message, {this.status = 0, this.upgrade = false, this.issues = const {}});
  @override
  String toString() => message;
}

/// Client for the backend's token-authenticated `/api/v1` — the same server-side rules (validation,
/// plan limits) the website uses. The app never talks to the AI model directly.
class Api {
  Api._();
  static final Api instance = Api._();

  Map<String, String> get _headers {
    final token = Supabase.instance.client.auth.currentSession?.accessToken;
    return {'Content-Type': 'application/json', if (token != null) 'Authorization': 'Bearer $token'};
  }

  Uri _uri(String path, [Map<String, String>? q]) => Uri.parse('${Config.apiBase}/api/v1$path').replace(queryParameters: q);

  Future<Map<String, dynamic>> _send(Future<http.Response> Function() call) async {
    http.Response r;
    try {
      r = await call().timeout(const Duration(seconds: 30));
    } on TimeoutException {
      throw ApiException('The server took too long to respond. Check your connection and try again.');
    } catch (_) {
      throw ApiException('Cannot reach the server. Check your connection and try again.');
    }
    Map<String, dynamic> body = {};
    try {
      final d = jsonDecode(utf8.decode(r.bodyBytes));
      if (d is Map<String, dynamic>) body = d;
    } catch (_) {}
    if (r.statusCode >= 200 && r.statusCode < 300) return body;
    final issues = (body['issues'] is Map) ? (body['issues'] as Map).map((k, v) => MapEntry('$k', '$v')) : <String, String>{};
    throw ApiException(
      r.statusCode == 401 ? 'Your session expired. Please sign in again.' : (body['message'] as String?) ?? 'Something went wrong (${r.statusCode}).',
      status: r.statusCode, upgrade: r.statusCode == 402 || body['upgrade'] == true, issues: issues);
  }

  Future<Map<String, dynamic>> get(String path, [Map<String, String>? q]) => _send(() => http.get(_uri(path, q), headers: _headers));
  Future<Map<String, dynamic>> post(String path, Object body) => _send(() => http.post(_uri(path), headers: _headers, body: jsonEncode(body)));
  Future<Map<String, dynamic>> put(String path, Object body) => _send(() => http.put(_uri(path), headers: _headers, body: jsonEncode(body)));
  Future<void> delete(String path) => _send(() => http.delete(_uri(path), headers: _headers));

  // ---- profile
  Future<LoadedProfile> loadProfile() async {
    final r = await get('/profile');
    final v = r['value'] as Map<String, dynamic>;
    return LoadedProfile(v['id'] as String, v['updatedAt'] as String, Map<String, dynamic>.from(v['profile'] as Map));
  }

  /// Returns the new updatedAt. Throws [ApiException] with `issues` (field path → message) when invalid.
  Future<String> saveProfile(LoadedProfile p, {String? snapshotLabel}) async {
    final r = await put('/profile', {'id': p.id, 'profile': p.data, 'expectedUpdatedAt': p.updatedAt, if (snapshotLabel != null) 'snapshotLabel': snapshotLabel});
    return r['updatedAt'] as String;
  }

  // ---- catalogue
  Future<List<Map<String, dynamic>>> countries() async => ((await get('/countries'))['countries'] as List).cast<Map<String, dynamic>>();
  Future<Map<String, dynamic>> templates() => get('/templates');
  Future<Map<String, dynamic>> defaultLayout(String country, String locale, {String? title, bool premium = false}) async =>
      (await get('/resume-defaults', {'country': country, 'locale': locale, if (title != null) 'title': title, if (premium) 'premium': '1'}))['layout'] as Map<String, dynamic>;
  Future<Map<String, dynamic>> plan() => get('/plan');

  // ---- resumes
  Future<String> createResume(Map<String, dynamic> layout) async => ((await post('/resumes', {'layout': layout}))['value'] as Map)['id'] as String;
  Future<LoadedResume> loadResume(String id) async {
    final r = await get('/resumes/$id');
    return LoadedResume(id, r['updatedAt'] as String, Map<String, dynamic>.from(r['layout'] as Map));
  }

  Future<String> saveResume(String id, Map<String, dynamic> layout, String expectedUpdatedAt) async =>
      ((await put('/resumes/$id', {'layout': layout, 'expectedUpdatedAt': expectedUpdatedAt}))['value'] as Map)['updatedAt'] as String;

  Future<String> previewHtml(String id) async {
    try {
      final r = await http.get(_uri('/resumes/$id/preview'), headers: _headers).timeout(const Duration(seconds: 30));
      if (r.statusCode != 200) throw ApiException('Preview unavailable (${r.statusCode}).', status: r.statusCode);
      return Config.fixHost(utf8.decode(r.bodyBytes));
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException('Cannot reach the server to load the preview.');
    }
  }

  Future<Map<String, dynamic>> analyze(String resumeId, {String? jobDescription}) async =>
      (await post('/resumes/$resumeId/ats', {if (jobDescription != null && jobDescription.trim().isNotEmpty) 'jobDescription': jobDescription}))['result'] as Map<String, dynamic>;

  // ---- AI (queue → poll → result; quotas enforced by the server)
  Future<String> requestAi(Map<String, dynamic> input) async => (await post('/ai-jobs', {'input': input}))['jobId'] as String;
  Future<Map<String, dynamic>> aiJob(String id) => get('/ai-jobs/$id');
  Future<void> cancelAi(String id) async {
    try {
      await delete('/ai-jobs/$id');
    } catch (_) {}
  }

  // ---- exports
  Future<String> requestExport(String resumeId, String format) async => ((await post('/exports', {'resumeId': resumeId, 'format': format}))['value'] as Map)['id'] as String;
  Future<Map<String, dynamic>> exportState(String id) => get('/exports/$id');
}

class LoadedProfile {
  final String id;
  String updatedAt;
  Map<String, dynamic> data;
  LoadedProfile(this.id, this.updatedAt, this.data);
}

class LoadedResume {
  final String id;
  String updatedAt;
  Map<String, dynamic> layout;
  LoadedResume(this.id, this.updatedAt, this.layout);
}
