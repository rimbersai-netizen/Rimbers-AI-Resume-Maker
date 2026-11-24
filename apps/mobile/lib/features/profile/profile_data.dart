typedef Json = Map<String, dynamic>;

/// The editable list stored under [key], as the SAME list object every time.
///
/// Editing cards mutate these maps in place, so a keystroke is part of the profile immediately and survives rebuilds and
/// "Save". (Returning a fresh copy per build — the earlier behaviour — silently dropped typed-in values.)
List<Json> liveList(Json profile, String key) {
  final raw = profile[key];
  if (raw is List<Json>) return raw;
  final live = ((raw as List?) ?? const []).map((e) => Json.from(e as Map)).toList();
  profile[key] = live;
  return live;
}

bool _isBlank(Json m, List<String> keys) => keys.every((k) => ((m[k] as String?) ?? '').trim().isEmpty);

/// Drop entries the user added but never filled in (e.g. an empty "Add experience" card), so they cannot block saving.
void pruneBlankEntries(Json data) {
  liveList(data, 'experience').removeWhere((w) => _isBlank(w, ['title', 'employer']) && liveList(w, 'bullets').every((b) => _isBlank(b, ['text'])));
  liveList(data, 'education').removeWhere((e) => _isBlank(e, ['institution', 'qualification', 'field']));
  liveList(data, 'skills').removeWhere((s) => _isBlank(s, ['name']));
  liveList(data, 'languages').removeWhere((l) => _isBlank(l, ['language']));
  liveList(data, 'certifications').removeWhere((c) => _isBlank(c, ['name']));
}
