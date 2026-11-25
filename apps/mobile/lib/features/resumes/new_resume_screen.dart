import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';
import '../../core/data.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import 'import_card.dart';

/// Create a resume: country (suggests conventions) → language (independent!) → template → name.
class NewResumeScreen extends ConsumerStatefulWidget {
  final String? initialTemplate;
  const NewResumeScreen({super.key, this.initialTemplate});
  @override
  ConsumerState<NewResumeScreen> createState() => _NewResumeState();
}

class _NewResumeState extends ConsumerState<NewResumeScreen> {
  final _title = TextEditingController(text: 'My Resume');
  final _search = TextEditingController();
  String? _country;
  Map<String, dynamic>? _layout;
  bool _loadingLayout = false, _creating = false;
  String? _error;
  bool _upgrade = false;

  Future<void> _pickCountry(String code) async {
    setState(() { _country = code; _loadingLayout = true; _error = null; });
    try {
      final l = await Api.instance.defaultLayout(code, 'en', title: _title.text.trim().isEmpty ? null : _title.text.trim());
      final tpl = widget.initialTemplate;
      if (mounted) setState(() => _layout = tpl == null ? l : {...l, 'templateId': tpl});
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loadingLayout = false);
    }
  }

  Future<void> _create() async {
    final layout = _layout;
    if (layout == null) return;
    final title = _title.text.trim();
    if (title.isEmpty) return setState(() => _error = 'Give your resume a name.');
    setState(() { _creating = true; _error = null; _upgrade = false; });
    try {
      final id = await Api.instance.createResume({...layout, 'title': title});
      if (mounted) context.pushReplacement('/resumes/$id');
    } on ApiException catch (e) {
      if (mounted) setState(() { _error = e.message; _upgrade = e.upgrade; });
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final countries = ref.watch(countriesProvider);
    final templates = ref.watch(templatesProvider);
    final layout = _layout;
    return Scaffold(
      appBar: AppBar(title: const Text('New Resume')),
      body: ListView(padding: const EdgeInsets.all(Tokens.gutter), children: [
        const ImportResumeCard(),
        const SizedBox(height: 8),
        TextField(controller: _title, maxLength: 200, decoration: const InputDecoration(labelText: 'Resume name', counterText: '')),
        Section(title: '1. Where are you applying?', children: [
          const Text('Country suggests the page size, photo and section order. These are conventions, not rules — you can change everything.', style: TextStyle(color: Tokens.textSecondary)),
          const SizedBox(height: 10),
          TextField(controller: _search, onChanged: (_) => setState(() {}), decoration: const InputDecoration(hintText: 'Search countries', prefixIcon: Icon(Icons.search))),
          const SizedBox(height: 8),
          countries.when(
            loading: () => const Padding(padding: EdgeInsets.all(16), child: Loading()),
            error: (_, __) => ErrorBanner('Could not load countries.', onRetry: () => ref.invalidate(countriesProvider)),
            data: (all) {
              final q = _search.text.trim().toLowerCase();
              final list = all.where((c) => q.isEmpty || (c['name'] as String).toLowerCase().contains(q) || (c['countryCode'] as String).toLowerCase() == q).toList();
              return ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 260),
                child: Card(
                  child: list.isEmpty
                      ? const Padding(padding: EdgeInsets.all(16), child: Text('No match'))
                      : ListView.builder(
                          shrinkWrap: true, itemCount: list.length,
                          itemBuilder: (_, i) {
                            final c = list[i];
                            final sel = c['countryCode'] == _country;
                            return ListTile(
                              dense: true, selected: sel, selectedTileColor: Tokens.subtle,
                              leading: Text(c['flag'] as String, style: const TextStyle(fontSize: 22)),
                              title: Text(c['name'] as String), subtitle: Text('${(c['documentName'] as String).toUpperCase()} · ${c['pageSize']}'),
                              trailing: sel ? const Icon(Icons.check_circle, color: Tokens.brand) : null,
                              onTap: () => _pickCountry(c['countryCode'] as String),
                            );
                          },
                        ),
                ),
              );
            },
          ),
          if (_loadingLayout) const Padding(padding: EdgeInsets.only(top: 12), child: Loading()),
        ]),
        if (layout != null) ...[
          Section(title: '2. Resume language', children: [
            const Text('Independent of your app language and of the country.', style: TextStyle(color: Tokens.textSecondary)),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: resumeLanguages.containsKey(layout['locale']) ? layout['locale'] as String : 'en',
              items: [for (final e in resumeLanguages.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
              onChanged: (v) => setState(() => _layout = {...layout, 'locale': v}),
            ),
          ]),
          Section(title: '3. Template', children: [
            templates.when(
              loading: () => const Loading(),
              error: (_, __) => ErrorBanner('Could not load templates.', onRetry: () => ref.invalidate(templatesProvider)),
              data: (t) => _TemplatePicker(
                data: t, selected: layout['templateId'] as String, onSelect: (id) => setState(() => _layout = {...layout, 'templateId': id})),
            ),
          ]),
          Section(title: '4. Options', children: [
            DropdownButtonFormField<String>(
              value: layout['pageSize'] as String, decoration: const InputDecoration(labelText: 'Page size'),
              items: const [DropdownMenuItem(value: 'A4', child: Text('A4')), DropdownMenuItem(value: 'Letter', child: Text('US Letter'))],
              onChanged: (v) => setState(() => _layout = {...layout, 'pageSize': v}),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero, title: const Text('Include a photo'), subtitle: const Text('Optional. Many countries expect none.'),
              value: layout['includePhoto'] as bool, onChanged: (v) => setState(() => _layout = {...layout, 'includePhoto': v})),
          ]),
          const SizedBox(height: 16),
          if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: ErrorBanner(_error!, onUpgrade: _upgrade ? () => context.push('/plans') : null)),
          GradientButton(label: 'Create Resume', trailing: Icons.arrow_forward, busy: _creating, onPressed: _create),
        ] else if (_error != null)
          Padding(padding: const EdgeInsets.only(top: 16), child: ErrorBanner(_error!)),
        const SizedBox(height: 24),
      ]),
    );
  }
}

class _TemplatePicker extends StatefulWidget {
  final Map<String, dynamic> data;
  final String selected;
  final ValueChanged<String> onSelect;
  const _TemplatePicker({required this.data, required this.selected, required this.onSelect});
  @override
  State<_TemplatePicker> createState() => _TemplatePickerState();
}

class _TemplatePickerState extends State<_TemplatePicker> {
  String _cat = 'All';
  @override
  Widget build(BuildContext context) {
    final cats = ['All', ...((widget.data['categories'] as List).cast<String>())];
    final all = (widget.data['templates'] as List).cast<Map<String, dynamic>>();
    final list = all.where((t) => _cat == 'All' || t['category'] == _cat).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(
        height: 40,
        child: ListView(scrollDirection: Axis.horizontal, children: [
          for (final c in cats)
            Padding(padding: const EdgeInsetsDirectional.only(end: 8), child: ChoiceChip(label: Text(c == 'All' ? c : prettyCategory(c)), selected: _cat == c, onSelected: (_) => setState(() => _cat = c), selectedColor: Tokens.brand, labelStyle: TextStyle(color: _cat == c ? Colors.white : Tokens.textPrimary))),
        ]),
      ),
      const SizedBox(height: 10),
      ConstrainedBox(
        constraints: const BoxConstraints(maxHeight: 280),
        child: GridView.builder(
          shrinkWrap: true, itemCount: list.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 2.4),
          itemBuilder: (_, i) {
            final t = list[i];
            final sel = t['id'] == widget.selected;
            return InkWell(
              borderRadius: BorderRadius.circular(12), onTap: () => widget.onSelect(t['id'] as String),
              child: Ink(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: sel ? Tokens.subtle : Tokens.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: sel ? Tokens.brand : Tokens.border, width: sel ? 2 : 1)),
                child: Row(children: [
                  Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(t['name'] as String, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                    Text(t['premium'] == true ? '${prettyCategory(t['category'] as String)} · Pro' : prettyCategory(t['category'] as String), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Tokens.textSecondary, fontSize: 12)),
                  ])),
                  if (sel) const Icon(Icons.check_circle, color: Tokens.brand, size: 20),
                ]),
              ),
            );
          },
        ),
      ),
    ]);
  }
}
