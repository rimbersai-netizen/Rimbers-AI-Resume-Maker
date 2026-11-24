import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';
import '../../core/api.dart';
import '../../core/data.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../home/shell.dart';

const _uuid = Uuid();
const _employmentTypes = {'full_time': 'Full-time', 'part_time': 'Part-time', 'contract': 'Contract', 'internship': 'Internship', 'freelance': 'Freelance', 'temporary': 'Temporary', 'volunteer': 'Volunteer'};
const _steps = ['Personal', 'Experience', 'Education', 'Skills'];

typedef Json = Map<String, dynamic>;

List<Json> _list(Json p, String key) => ((p[key] as List?) ?? []).map((e) => Json.from(e as Map)).toList();

class ProfileScreen extends ConsumerStatefulWidget {
  final int initialStep;
  const ProfileScreen({super.key, this.initialStep = 0});
  @override
  ConsumerState<ProfileScreen> createState() => _ProfileState();
}

class _ProfileState extends ConsumerState<ProfileScreen> {
  LoadedProfile? _p;
  String? _loadError;
  late int _step = widget.initialStep.clamp(0, _steps.length - 1);
  bool _saving = false, _dirty = false;
  Map<String, String> _issues = {};
  String? _message;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loadError = null);
    try {
      final p = await Api.instance.loadProfile();
      if (mounted) setState(() => _p = p);
    } on ApiException catch (e) {
      if (mounted) setState(() => _loadError = e.message);
    }
  }

  Json get _data => _p!.data;
  void _touch() => setState(() { _dirty = true; _message = null; });

  /// Save through the backend (shared Zod validation). Returns true on success.
  Future<bool> _save() async {
    setState(() { _saving = true; _issues = {}; _message = null; });
    try {
      final updated = await Api.instance.saveProfile(_p!);
      _p!.updatedAt = updated;
      ref.invalidate(profileProvider);
      if (mounted) setState(() => _dirty = false);
      return true;
    } on ApiException catch (e) {
      if (!mounted) return false;
      setState(() {
        _issues = e.issues;
        _message = e.status == 409 ? 'This profile changed on another device. Reload to see the latest.' : (e.issues.isNotEmpty ? 'Fix the highlighted fields.' : e.message);
        if (e.issues.isNotEmpty) {
          final first = e.issues.keys.first;
          _step = first.startsWith('experience') ? 1 : first.startsWith('education') ? 2 : (first.startsWith('skills') || first.startsWith('languages') || first.startsWith('certifications')) ? 3 : 0;
        }
      });
      return false;
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _next() async {
    if (!await _save() || !mounted) return;
    if (_step < _steps.length - 1) {
      setState(() => _step++);
    } else {
      toast(context, 'Profile saved');
      context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loadError != null) return Scaffold(appBar: AppBar(title: const Text('Your Profile')), body: Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(_loadError!, onRetry: _load)));
    if (_p == null) return Scaffold(appBar: AppBar(title: const Text('Your Profile')), body: const Loading());
    return PopScope(
      canPop: !_dirty,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final leave = await confirm(context, title: 'Discard unsaved changes?', body: 'Your edits to this step have not been saved.', action: 'Discard');
        if (leave && context.mounted) context.pop();
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('Create Your Profile')),
        body: Column(children: [
          _Stepper(step: _step, onTap: (i) => setState(() => _step = i)),
          Expanded(
            child: ListView(padding: const EdgeInsets.all(Tokens.gutter), children: [
              if (_message != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: ErrorBanner(_message!)),
              [_personal(), _experience(), _education(), _skills()][_step],
              const SizedBox(height: 24),
              Row(children: [
                if (_step > 0) Expanded(child: OutlineButton(label: 'Back', onPressed: () => setState(() => _step--))),
                if (_step > 0) const SizedBox(width: 12),
                Expanded(flex: 2, child: GradientButton(label: _step == _steps.length - 1 ? 'Save Profile' : 'Save & Continue', trailing: Icons.arrow_forward, busy: _saving, onPressed: _next)),
              ]),
              const SizedBox(height: 24),
            ]),
          ),
        ]),
      ),
    );
  }

  // ------------------------------------------------------------------ fields
  Widget _text(String label, String? value, void Function(String) set, {String? issue, TextInputType? type, int maxLines = 1, int? maxLength, String? hint, bool required = false, String? keyId}) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: TextFormField(
          key: ValueKey('$label-${keyId ?? ''}'),
          initialValue: value ?? '', keyboardType: type, maxLines: maxLines, maxLength: maxLength, textCapitalization: type == null ? TextCapitalization.sentences : TextCapitalization.none,
          decoration: InputDecoration(labelText: required ? '$label *' : label, hintText: hint, errorText: issue, counterText: maxLength == null ? null : null),
          onChanged: (v) { set(v); _touch(); },
        ),
      );

  Widget _date(String label, String? value, void Function(String?) set, {String? issue, bool enabled = true, String? keyId}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: InkWell(
        onTap: !enabled ? null : () async {
          final now = DateTime.now();
          final init = DateTime.tryParse('${value ?? ''}-01') ?? now;
          final d = await showDatePicker(context: context, initialDate: init, firstDate: DateTime(1950), lastDate: DateTime(now.year + 1), initialDatePickerMode: DatePickerMode.year, helpText: label);
          if (d != null) { set('${d.year}-${d.month.toString().padLeft(2, '0')}'); _touch(); }
        },
        child: InputDecorator(
          decoration: InputDecoration(labelText: label, errorText: issue, enabled: enabled, suffixIcon: value == null || !enabled ? const Icon(Icons.calendar_today_outlined, size: 18) : IconButton(icon: const Icon(Icons.clear, size: 18), tooltip: 'Clear', onPressed: () { set(null); _touch(); })),
          child: Text(enabled ? (value ?? 'Select month') : 'Present', style: TextStyle(color: value == null || !enabled ? Tokens.textSecondary : Tokens.textPrimary)),
        ),
      ),
    );
  }

  // ------------------------------------------------------------------ step 1
  Widget _personal() {
    final per = Json.from((_data['personal'] as Map?) ?? {});
    final loc = Json.from((per['location'] as Map?) ?? {});
    void set(String k, String v) { per[k] = v; _data['personal'] = per; }
    void setLoc(String k, String v) { loc[k] = v; per['location'] = loc; _data['personal'] = per; }
    final countries = ref.watch(countriesProvider).value ?? const [];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Personal Information', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
      const SizedBox(height: 4),
      const Text('Entered once, reused on every resume. A photo, date of birth and nationality are always optional.', style: TextStyle(color: Tokens.textSecondary)),
      const SizedBox(height: 16),
      _text('Full name', per['fullName'] as String?, (v) => set('fullName', v), issue: _issues['personal.fullName'], required: true),
      _text('Professional title', per['professionalTitle'] as String?, (v) => set('professionalTitle', v), issue: _issues['personal.professionalTitle'], hint: 'e.g. Senior Software Engineer'),
      _text('Email', per['email'] as String?, (v) => set('email', v), issue: _issues['personal.email'], type: TextInputType.emailAddress),
      _text('Phone', per['phone'] as String?, (v) => set('phone', v), issue: _issues['personal.phone'], type: TextInputType.phone, hint: '+966 55 123 4567'),
      _text('City', loc['city'] as String?, (v) => setLoc('city', v)),
      Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: DropdownButtonFormField<String>(
          value: countries.any((c) => c['countryCode'] == loc['country']) ? loc['country'] as String : null,
          decoration: const InputDecoration(labelText: 'Country'), isExpanded: true,
          items: [for (final c in countries) DropdownMenuItem(value: c['countryCode'] as String, child: Text('${c['flag']}  ${c['name']}', overflow: TextOverflow.ellipsis))],
          onChanged: (v) { if (v != null) { setLoc('country', v); _touch(); } },
        ),
      ),
      _text('LinkedIn', per['linkedin'] as String?, (v) => set('linkedin', v), issue: _issues['personal.linkedin'], type: TextInputType.url, hint: 'https://linkedin.com/in/…'),
      _text('Website / portfolio', per['website'] as String?, (v) => set('website', v), issue: _issues['personal.website'], type: TextInputType.url, hint: 'https://…'),
      _text('Professional summary', _data['summary'] as String?, (v) => _data['summary'] = v, issue: _issues['summary'], maxLines: 5, maxLength: 1200, hint: 'A few lines about your experience and strengths'),
      Align(alignment: AlignmentDirectional.centerStart, child: TextButton.icon(onPressed: () => context.push('/ai-writer').then((_) => _load()), icon: const Icon(Icons.auto_awesome, size: 18), label: const Text('Write summary with AI'))),
    ]);
  }

  // ------------------------------------------------------------------ step 2
  Widget _experience() {
    final items = _list(_data, 'experience');
    void commit() { _data['experience'] = items; _touch(); }
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Work Experience', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
      const SizedBox(height: 4),
      const Text('Only real roles. AI never adds employers, dates or numbers you did not provide.', style: TextStyle(color: Tokens.textSecondary)),
      const SizedBox(height: 12),
      if (items.isEmpty) const Card(child: Padding(padding: EdgeInsets.all(16), child: Text('No experience added yet. Students and first-time applicants can skip this step.', style: TextStyle(color: Tokens.textSecondary)))),
      for (var i = 0; i < items.length; i++) _experienceCard(items, i, commit),
      const SizedBox(height: 8),
      OutlineButton(label: 'Add experience', icon: Icons.add, onPressed: () {
        items.add({'id': _uuid.v4(), 'employer': '', 'title': '', 'dates': {'current': false}, 'bullets': <Json>[]});
        commit();
      }),
    ]);
  }

  Widget _experienceCard(List<Json> items, int i, VoidCallback commit) {
    final w = items[i];
    final id = w['id'] as String;
    final dates = Json.from((w['dates'] as Map?) ?? {'current': false});
    final bullets = _list(w, 'bullets');
    final p = 'experience.$i';
    void setW(String k, Object? v) { if (v == null || v == '') { w.remove(k); } else { w[k] = v; } items[i] = w; commit(); }
    void setDates(String k, Object? v) { if (v == null) { dates.remove(k); } else { dates[k] = v; } if (dates['current'] == true) dates.remove('end'); w['dates'] = dates; items[i] = w; commit(); }
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text('Role ${i + 1}', style: const TextStyle(fontWeight: FontWeight.w700))),
              IconButton(tooltip: 'Move up', icon: const Icon(Icons.arrow_upward, size: 20), onPressed: i == 0 ? null : () { items.insert(i - 1, items.removeAt(i)); commit(); }),
              IconButton(tooltip: 'Move down', icon: const Icon(Icons.arrow_downward, size: 20), onPressed: i == items.length - 1 ? null : () { items.insert(i + 1, items.removeAt(i)); commit(); }),
              IconButton(tooltip: 'Delete role', icon: const Icon(Icons.delete_outline, color: Tokens.danger), onPressed: () async {
                if (await confirm(context, title: 'Delete this role?', body: 'It will be removed from your profile. Resumes you already created keep their own settings.')) { items.removeAt(i); commit(); }
              }),
            ]),
            _text('Job title', w['title'] as String?, (v) => w['title'] = v, issue: _issues['$p.title'], required: true, keyId: id),
            _text('Company', w['employer'] as String?, (v) => w['employer'] = v, issue: _issues['$p.employer'], required: true, keyId: id),
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: DropdownButtonFormField<String>(
                key: ValueKey('et-$id'), value: w['employmentType'] as String?, decoration: const InputDecoration(labelText: 'Employment type'),
                items: [for (final e in _employmentTypes.entries) DropdownMenuItem(value: e.key, child: Text(e.value))], onChanged: (v) => setW('employmentType', v)),
            ),
            _text('Location', w['location'] as String?, (v) => w['location'] = v, keyId: id),
            Row(children: [
              Expanded(child: _date('Start', dates['start'] as String?, (v) => setDates('start', v), issue: _issues['$p.dates.start'], keyId: id)),
              const SizedBox(width: 10),
              Expanded(child: _date('End', dates['end'] as String?, (v) => setDates('end', v), issue: _issues['$p.dates.end'], enabled: dates['current'] != true, keyId: id)),
            ]),
            CheckboxListTile(contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading, title: const Text('I currently work here'), value: dates['current'] == true, onChanged: (v) => setDates('current', v ?? false)),
            const Text('Responsibilities & achievements', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            for (var b = 0; b < bullets.length; b++)
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(child: _text('Bullet ${b + 1}', bullets[b]['text'] as String?, (v) { bullets[b]['text'] = v; w['bullets'] = bullets; }, issue: _issues['$p.bullets.$b.text'], maxLines: 3, maxLength: 600, keyId: bullets[b]['id'] as String)),
                IconButton(tooltip: 'Remove bullet', icon: const Icon(Icons.close), onPressed: () { bullets.removeAt(b); w['bullets'] = bullets; items[i] = w; commit(); }),
              ]),
            TextButton.icon(onPressed: () { bullets.add({'id': _uuid.v4(), 'text': '', 'provenance': 'user'}); w['bullets'] = bullets; items[i] = w; commit(); }, icon: const Icon(Icons.add), label: const Text('Add bullet')),
          ]),
        ),
      ),
    );
  }

  // ------------------------------------------------------------------ step 3
  Widget _education() {
    final items = _list(_data, 'education');
    void commit() { _data['education'] = items; _touch(); }
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Education', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
      const SizedBox(height: 12),
      if (items.isEmpty) const Card(child: Padding(padding: EdgeInsets.all(16), child: Text('No education added yet.', style: TextStyle(color: Tokens.textSecondary)))),
      for (var i = 0; i < items.length; i++)
        Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Builder(builder: (context) {
                final e = items[i];
                final id = e['id'] as String;
                final dates = Json.from((e['dates'] as Map?) ?? {'current': false});
                final p = 'education.$i';
                void setDates(String k, String? v) { if (v == null) { dates.remove(k); } else { dates[k] = v; } e['dates'] = dates; items[i] = e; commit(); }
                return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text('Education ${i + 1}', style: const TextStyle(fontWeight: FontWeight.w700))),
                    IconButton(tooltip: 'Delete', icon: const Icon(Icons.delete_outline, color: Tokens.danger), onPressed: () async {
                      if (await confirm(context, title: 'Delete this entry?', body: 'It will be removed from your profile.')) { items.removeAt(i); commit(); }
                    }),
                  ]),
                  _text('Institution', e['institution'] as String?, (v) => e['institution'] = v, issue: _issues['$p.institution'], required: true, keyId: id),
                  _text('Qualification', e['qualification'] as String?, (v) => e['qualification'] = v, issue: _issues['$p.qualification'], required: true, keyId: id, hint: 'e.g. B.Sc.'),
                  _text('Field of study', e['field'] as String?, (v) => e['field'] = v, keyId: id),
                  Row(children: [
                    Expanded(child: _date('Start', dates['start'] as String?, (v) => setDates('start', v), issue: _issues['$p.dates.start'], keyId: id)),
                    const SizedBox(width: 10),
                    Expanded(child: _date('End', dates['end'] as String?, (v) => setDates('end', v), issue: _issues['$p.dates.end'], keyId: id)),
                  ]),
                  _text('Grade (optional)', e['grade'] as String?, (v) => e['grade'] = v, keyId: id),
                ]);
              }),
            ),
          ),
        ),
      OutlineButton(label: 'Add education', icon: Icons.add, onPressed: () { items.add({'id': _uuid.v4(), 'institution': '', 'qualification': '', 'dates': {'current': false}}); commit(); }),
    ]);
  }

  // ------------------------------------------------------------------ step 4
  Widget _skills() {
    final skills = _list(_data, 'skills');
    final languages = _list(_data, 'languages');
    final certs = _list(_data, 'certifications');
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Skills', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
      const SizedBox(height: 4),
      const Text('List only skills you really have — AI will never add any.', style: TextStyle(color: Tokens.textSecondary)),
      const SizedBox(height: 12),
      _ChipEditor(
        hint: 'Add a skill and press enter', values: [for (final s in skills) s['name'] as String],
        onAdd: (v) {
          if (skills.any((s) => (s['name'] as String).toLowerCase() == v.toLowerCase())) return;
          skills.add({'id': _uuid.v4(), 'name': v}); _data['skills'] = skills; _touch();
        },
        onRemove: (i) { skills.removeAt(i); _data['skills'] = skills; _touch(); },
      ),
      if (_issues.keys.any((k) => k.startsWith('skills'))) const Padding(padding: EdgeInsets.only(top: 6), child: Text('A skill name is not valid.', style: TextStyle(color: Tokens.danger))),
      Section(title: 'Languages', children: [
        for (var i = 0; i < languages.length; i++)
          Row(children: [
            Expanded(flex: 3, child: _text('Language', languages[i]['language'] as String?, (v) { languages[i]['language'] = v; _data['languages'] = languages; }, keyId: languages[i]['id'] as String, issue: _issues['languages.$i.language'])),
            const SizedBox(width: 8),
            Expanded(flex: 2, child: Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: DropdownButtonFormField<String>(
                key: ValueKey('lv-${languages[i]['id']}'), value: languages[i]['proficiency'] as String?, isExpanded: true, decoration: const InputDecoration(labelText: 'Level'),
                items: [for (final l in const ['native', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1']) DropdownMenuItem(value: l, child: Text(l == 'native' ? 'Native' : l))],
                onChanged: (v) { languages[i]['proficiency'] = v; _data['languages'] = languages; _touch(); }),
            )),
            IconButton(tooltip: 'Remove language', icon: const Icon(Icons.close), onPressed: () { languages.removeAt(i); _data['languages'] = languages; _touch(); }),
          ]),
        TextButton.icon(onPressed: () { languages.add({'id': _uuid.v4(), 'language': ''}); _data['languages'] = languages; _touch(); }, icon: const Icon(Icons.add), label: const Text('Add language')),
      ]),
      Section(title: 'Certifications', children: [
        for (var i = 0; i < certs.length; i++)
          Row(children: [
            Expanded(child: _text('Certification', certs[i]['name'] as String?, (v) { certs[i]['name'] = v; _data['certifications'] = certs; }, keyId: certs[i]['id'] as String, issue: _issues['certifications.$i.name'])),
            const SizedBox(width: 8),
            Expanded(child: _text('Issuer', certs[i]['issuer'] as String?, (v) { certs[i]['issuer'] = v; _data['certifications'] = certs; }, keyId: certs[i]['id'] as String)),
            IconButton(tooltip: 'Remove certification', icon: const Icon(Icons.close), onPressed: () { certs.removeAt(i); _data['certifications'] = certs; _touch(); }),
          ]),
        TextButton.icon(onPressed: () { certs.add({'id': _uuid.v4(), 'name': ''}); _data['certifications'] = certs; _touch(); }, icon: const Icon(Icons.add), label: const Text('Add certification')),
      ]),
    ]);
  }
}

class _Stepper extends StatelessWidget {
  final int step;
  final ValueChanged<int> onTap;
  const _Stepper({required this.step, required this.onTap});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(Tokens.gutter, 0, Tokens.gutter, 8),
        child: Row(children: [
          for (var i = 0; i < _steps.length; i++) ...[
            Expanded(
              child: InkWell(
                onTap: () => onTap(i),
                child: Column(children: [
                  CircleAvatar(radius: 14, backgroundColor: i <= step ? Tokens.brand : Tokens.border, child: i < step ? const Icon(Icons.check, size: 16, color: Colors.white) : Text('${i + 1}', style: TextStyle(color: i <= step ? Colors.white : Tokens.textSecondary, fontWeight: FontWeight.w700, fontSize: 13))),
                  const SizedBox(height: 4),
                  Text(_steps[i], style: TextStyle(fontSize: 11, color: i == step ? Tokens.brand : Tokens.textSecondary, fontWeight: i == step ? FontWeight.w700 : FontWeight.w400)),
                ]),
              ),
            ),
          ],
        ]),
      );
}

class _ChipEditor extends StatefulWidget {
  final String hint;
  final List<String> values;
  final ValueChanged<String> onAdd;
  final ValueChanged<int> onRemove;
  const _ChipEditor({required this.hint, required this.values, required this.onAdd, required this.onRemove});
  @override
  State<_ChipEditor> createState() => _ChipEditorState();
}

class _ChipEditorState extends State<_ChipEditor> {
  final _c = TextEditingController();
  void _add() {
    final v = _c.text.trim();
    if (v.isEmpty) return;
    widget.onAdd(v);
    _c.clear();
  }

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        TextField(controller: _c, onSubmitted: (_) => _add(), textInputAction: TextInputAction.done, decoration: InputDecoration(hintText: widget.hint, suffixIcon: IconButton(tooltip: 'Add skill', icon: const Icon(Icons.add_circle, color: Tokens.brand), onPressed: _add))),
        const SizedBox(height: 10),
        Wrap(spacing: 8, runSpacing: 8, children: [for (var i = 0; i < widget.values.length; i++) InputChip(label: Text(widget.values[i]), onDeleted: () => widget.onRemove(i), deleteButtonTooltipMessage: 'Remove ${widget.values[i]}')]),
      ]);
}
