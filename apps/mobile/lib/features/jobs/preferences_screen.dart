import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';
import '../../core/jobs_api.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

/// Three quick steps (roles → work style → pay & freshness), mirroring the web preferences page.
class JobPreferencesScreen extends StatefulWidget {
  const JobPreferencesScreen({super.key});
  @override
  State<JobPreferencesScreen> createState() => _JobPreferencesScreenState();
}

class _JobPreferencesScreenState extends State<JobPreferencesScreen> {
  static const _titles = ['What roles interest you?', 'How do you want to work?', 'Pay and freshness'];
  static const _salary = <int?, String>{null: 'Any', 30000: '\$30k+', 50000: '\$50k+', 75000: '\$75k+', 100000: '\$100k+', 150000: '\$150k+'};
  static const _fresh = <int?, String>{null: 'Any time', 1: 'Past 24 hours', 3: 'Past 3 days', 7: 'Past week', 14: 'Past 2 weeks', 30: 'Past month'};
  JobPrefs _p = JobPrefs();
  List<RoleOption> _roles = [];
  int _step = 0;
  bool _loading = true, _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final r = await Api.instance.jobPrefs();
      _p = r.prefs;
      _roles = r.roles;
    } on ApiException catch (e) {
      _error = e.message;
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await Api.instance.saveJobPrefs(_p);
      if (mounted) context.pop();
    } on ApiException catch (e) {
      if (mounted) { setState(() => _saving = false); toast(context, e.message); }
    }
  }

  void _toggle(List<String> list, String v) => setState(() => list.contains(v) ? list.remove(v) : list.add(v));

  Widget _option(String title, String? hint, bool on, VoidCallback onTap) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: InkWell(
          borderRadius: BorderRadius.circular(Tokens.rInput),
          onTap: onTap,
          child: Ink(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: on ? Tokens.subtle : Tokens.surface, borderRadius: BorderRadius.circular(Tokens.rInput), border: Border.all(color: on ? Tokens.brand : Tokens.border)),
            child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontWeight: FontWeight.w700)), if (hint != null) Text(hint, style: const TextStyle(color: Tokens.textSecondary, fontSize: 12.5))])),
              Icon(on ? Icons.check_circle : Icons.radio_button_unchecked, color: on ? Tokens.brand : Tokens.border),
            ]),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Job preferences')),
      body: _loading
          ? const Loading()
          : _error != null
              ? Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(_error!, onRetry: _load))
              : Padding(
                  padding: const EdgeInsets.all(Tokens.gutter),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [for (var i = 0; i < 3; i++) Expanded(child: Container(height: 4, margin: const EdgeInsets.only(right: 6), decoration: BoxDecoration(color: i <= _step ? Tokens.textPrimary : Tokens.border, borderRadius: BorderRadius.circular(4))))]),
                    const SizedBox(height: 18),
                    Text(_titles[_step], style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 6),
                    Text(const ['Pick as many as you like, or none to see everything.', 'Leave empty to see all.', 'Listings that do not state a salary are still shown.'][_step], style: const TextStyle(color: Tokens.textSecondary)),
                    const SizedBox(height: 16),
                    Expanded(
                      child: ListView(children: [
                        if (_step == 0) for (final r in _roles) _option(r.label, r.hint, _p.roles.contains(r.id), () => _toggle(_p.roles, r.id)),
                        if (_step == 1) for (final m in const [('remote', 'Remote'), ('hybrid', 'Hybrid'), ('onsite', 'On-site')]) _option(m.$2, null, _p.workModes.contains(m.$1), () => _toggle(_p.workModes, m.$1)),
                        if (_step == 2) ...[
                          DropdownButtonFormField<int?>(
                            value: _p.minSalary, decoration: const InputDecoration(labelText: 'Minimum salary (yearly)'),
                            items: [for (final e in _salary.entries) DropdownMenuItem(value: e.key, child: Text(e.value))], onChanged: (v) => setState(() => _p.minSalary = v)),
                          const SizedBox(height: 14),
                          DropdownButtonFormField<int?>(
                            value: _p.postedWithinDays, decoration: const InputDecoration(labelText: 'Date posted'),
                            items: [for (final e in _fresh.entries) DropdownMenuItem(value: e.key, child: Text(e.value))], onChanged: (v) => setState(() => _p.postedWithinDays = v)),
                        ],
                      ]),
                    ),
                    Row(children: [
                      if (_step > 0) Expanded(child: OutlineButton(label: 'Back', onPressed: () => setState(() => _step--))),
                      if (_step > 0) const SizedBox(width: 12),
                      Expanded(child: GradientButton(label: _step < 2 ? 'Continue' : 'Save and see jobs', busy: _saving, onPressed: _step < 2 ? () => setState(() => _step++) : _save)),
                    ]),
                  ]),
                ),
    );
  }
}
