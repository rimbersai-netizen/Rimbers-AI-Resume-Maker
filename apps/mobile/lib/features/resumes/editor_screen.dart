import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../core/api.dart';
import '../../core/config.dart';
import '../../core/data.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

const _sectionNames = {
  'summary': 'Professional Summary', 'experience': 'Work Experience', 'education': 'Education', 'skills': 'Skills', 'certifications': 'Certifications',
  'languages': 'Languages', 'projects': 'Projects', 'publications': 'Publications', 'awards': 'Awards', 'volunteer': 'Volunteer', 'references': 'References', 'custom': 'Custom',
};

class EditorScreen extends ConsumerStatefulWidget {
  final String resumeId;
  final int initialTab;
  const EditorScreen({super.key, required this.resumeId, this.initialTab = 0});
  @override
  ConsumerState<EditorScreen> createState() => _EditorState();
}

class _EditorState extends ConsumerState<EditorScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 4, vsync: this, initialIndex: widget.initialTab.clamp(0, 3));
  LoadedResume? _resume;
  String? _loadError;
  String _status = 'saved'; // saved | saving | error | conflict
  String? _statusMessage;
  Timer? _debounce;
  int _previewKey = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loadError = null);
    try {
      final r = await Api.instance.loadResume(widget.resumeId);
      if (mounted) setState(() => _resume = r);
    } on ApiException catch (e) {
      if (mounted) setState(() => _loadError = e.status == 404 ? 'This resume no longer exists.' : e.message);
    }
  }

  /// Apply an edit locally, then autosave (debounced). Sections/templates changes refresh the preview after saving.
  void _edit(Map<String, dynamic> Function(Map<String, dynamic>) change) {
    final r = _resume!;
    setState(() { r.layout = change(Map<String, dynamic>.from(r.layout)); _status = 'saving'; });
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 800), _save);
  }

  Future<void> _save() async {
    final r = _resume;
    if (r == null) return;
    try {
      r.updatedAt = await Api.instance.saveResume(r.id, r.layout, r.updatedAt);
      if (mounted) setState(() { _status = 'saved'; _previewKey++; });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() { _status = e.status == 409 ? 'conflict' : 'error'; _statusMessage = e.message; });
      if (e.upgrade) toast(context, e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = _resume;
    if (_loadError != null) {
      return Scaffold(appBar: AppBar(), body: Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(_loadError!, onRetry: _load)));
    }
    if (r == null) return Scaffold(appBar: AppBar(), body: const Loading());
    return Scaffold(
      appBar: AppBar(
        title: Text(r.layout['title'] as String, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(tooltip: 'ATS analysis', icon: const Icon(Icons.verified_outlined), onPressed: () => context.push('/resumes/${r.id}/ats')),
        ],
        bottom: TabBar(controller: _tabs, labelColor: Tokens.brand, indicatorColor: Tokens.brand, tabs: const [Tab(text: 'Preview'), Tab(text: 'Style'), Tab(text: 'Sections'), Tab(text: 'Export')]),
      ),
      body: Column(children: [
        _StatusBar(status: _status, message: _statusMessage, onRetry: _save, onReload: () { setState(() { _resume = null; _status = 'saved'; }); _load(); }),
        Expanded(
          child: TabBarView(controller: _tabs, physics: const NeverScrollableScrollPhysics(), children: [
            _PreviewTab(key: ValueKey('p$_previewKey'), resumeId: r.id, onEditProfile: () => context.push('/profile/edit').then((_) => setState(() => _previewKey++))),
            _StyleTab(layout: r.layout, onChange: _edit),
            _SectionsTab(layout: r.layout, onChange: _edit),
            _ExportTab(resumeId: r.id, saving: _status == 'saving', title: r.layout['title'] as String),
          ]),
        ),
      ]),
    );
  }
}

class _StatusBar extends StatelessWidget {
  final String status;
  final String? message;
  final VoidCallback onRetry, onReload;
  const _StatusBar({required this.status, this.message, required this.onRetry, required this.onReload});
  @override
  Widget build(BuildContext context) {
    if (status == 'saved') return const SizedBox.shrink();
    final (text, color, action) = switch (status) {
      'saving' => ('Saving…', Tokens.textSecondary, null),
      'conflict' => (message ?? 'Changed on another device.', Tokens.warning, TextButton(onPressed: onReload, child: const Text('Reload'))),
      _ => (message ?? 'Could not save.', Tokens.danger, TextButton(onPressed: onRetry, child: const Text('Retry'))),
    };
    return Container(
      width: double.infinity, color: color.withOpacity(0.1), padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Row(children: [Expanded(child: Text(text, style: TextStyle(color: color, fontSize: 13))), if (action != null) action]),
    );
  }
}

class _PreviewTab extends StatefulWidget {
  final String resumeId;
  final VoidCallback onEditProfile;
  const _PreviewTab({super.key, required this.resumeId, required this.onEditProfile});
  @override
  State<_PreviewTab> createState() => _PreviewTabState();
}

class _PreviewTabState extends State<_PreviewTab> {
  WebViewController? _web;
  String? _html, _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final html = await Api.instance.previewHtml(widget.resumeId);
      if (!mounted) return;
      if (!kIsWeb) {
        _web = WebViewController()
          ..setJavaScriptMode(JavaScriptMode.disabled)
          ..setBackgroundColor(Colors.white)
          ..loadHtmlString(html, baseUrl: Config.apiBase);
      }
      setState(() => _html = html);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) return Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(_error!, onRetry: () { setState(() => _error = null); _load(); }));
    if (_html == null) return const Loading(label: 'Rendering preview…');
    return Column(children: [
      Expanded(
        child: kIsWeb
            ? const EmptyState(icon: Icons.phone_android, title: 'Preview runs in the phone app', body: 'Open this resume on Android or iOS to see the live document.')
            : Container(margin: const EdgeInsets.all(12), decoration: BoxDecoration(color: Colors.white, boxShadow: Tokens.shadow), child: WebViewWidget(controller: _web!)),
      ),
      Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 12), child: OutlineButton(label: 'Edit profile content', icon: Icons.edit_outlined, onPressed: widget.onEditProfile)),
    ]);
  }
}

class _StyleTab extends ConsumerWidget {
  final Map<String, dynamic> layout;
  final void Function(Map<String, dynamic> Function(Map<String, dynamic>)) onChange;
  const _StyleTab({required this.layout, required this.onChange});

  /// Mark a country-suggested field as the user's own choice so a later country change never overwrites it.
  Map<String, dynamic> _override(Map<String, dynamic> l, String field, Object? value) => {
        ...l, field: value,
        'settings': {...(l['settings'] as Map<String, dynamic>), 'overridden': {...((l['settings'] as Map)['overridden'] as List).cast<String>(), field}.toList()},
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final templates = ref.watch(templatesProvider);
    return ListView(padding: const EdgeInsets.all(Tokens.gutter), children: [
      TextFormField(initialValue: layout['title'] as String, maxLength: 200, decoration: const InputDecoration(labelText: 'Resume name', counterText: ''), onChanged: (v) { if (v.trim().isNotEmpty) onChange((l) => {...l, 'title': v.trim()}); }),
      const SizedBox(height: 14),
      DropdownButtonFormField<String>(
        value: resumeLanguages.containsKey(layout['locale']) ? layout['locale'] as String : 'en', decoration: const InputDecoration(labelText: 'Resume language'),
        items: [for (final e in resumeLanguages.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
        onChanged: (v) => onChange((l) => _override(l, 'locale', v))),
      const SizedBox(height: 14),
      DropdownButtonFormField<String>(
        value: layout['pageSize'] as String, decoration: const InputDecoration(labelText: 'Page size'),
        items: const [DropdownMenuItem(value: 'A4', child: Text('A4')), DropdownMenuItem(value: 'Letter', child: Text('US Letter'))],
        onChanged: (v) => onChange((l) => _override(l, 'pageSize', v))),
      SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Include photo'), subtitle: const Text('Optional — add it in your profile.'), value: layout['includePhoto'] as bool, onChanged: (v) => onChange((l) => _override(l, 'includePhoto', v))),
      Section(title: 'Template', children: [
        templates.when(
          loading: () => const Loading(),
          error: (_, __) => ErrorBanner('Could not load templates.', onRetry: () => ref.invalidate(templatesProvider)),
          data: (t) {
            final list = (t['templates'] as List).cast<Map<String, dynamic>>();
            return SizedBox(
              height: 300,
              child: ListView.builder(
                itemCount: list.length,
                itemBuilder: (_, i) {
                  final x = list[i];
                  final sel = x['id'] == layout['templateId'];
                  return ListTile(
                    dense: true, selected: sel, selectedTileColor: Tokens.subtle,
                    title: Text(x['name'] as String), subtitle: Text(prettyCategory(x['category'] as String) + (x['premium'] == true ? ' · Pro' : '')),
                    trailing: sel ? const Icon(Icons.check_circle, color: Tokens.brand) : null,
                    onTap: () => onChange((l) => _override(l, 'templateId', x['id'])));
                },
              ),
            );
          },
        ),
      ]),
    ]);
  }
}

class _SectionsTab extends StatelessWidget {
  final Map<String, dynamic> layout;
  final void Function(Map<String, dynamic> Function(Map<String, dynamic>)) onChange;
  const _SectionsTab({required this.layout, required this.onChange});

  List<Map<String, dynamic>> get _sections => (layout['sections'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();

  void _set(List<Map<String, dynamic>> s) => onChange((l) => {
        ...l, 'sections': s,
        'settings': {...(l['settings'] as Map<String, dynamic>), 'overridden': {...((l['settings'] as Map)['overridden'] as List).cast<String>(), 'sectionOrder'}.toList()},
      });

  Future<void> _rename(BuildContext context, int i) async {
    final s = _sections;
    final c = TextEditingController(text: (s[i]['heading'] as String?) ?? '');
    final v = await showDialog<String>(
      context: context,
      builder: (d) => AlertDialog(
        title: const Text('Section heading'),
        content: TextField(controller: c, maxLength: 120, decoration: InputDecoration(hintText: _sectionNames[s[i]['key']] ?? '${s[i]['key']}', helperText: 'Leave empty to use the default')),
        actions: [TextButton(onPressed: () => Navigator.pop(d), child: const Text('Cancel')), TextButton(onPressed: () => Navigator.pop(d, c.text.trim()), child: const Text('Save'))],
      ),
    );
    if (v == null) return;
    if (v.isEmpty) { s[i].remove('heading'); } else { s[i]['heading'] = v; }
    _set(s);
  }

  @override
  Widget build(BuildContext context) {
    final s = _sections;
    return Column(children: [
      const Padding(padding: EdgeInsets.all(16), child: Text('Drag to reorder, toggle to show or hide, tap the pencil to rename a heading.', style: TextStyle(color: Tokens.textSecondary))),
      Expanded(
        child: ReorderableListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: s.length,
          onReorder: (a, b) {
            final list = _sections;
            if (b > a) b -= 1;
            list.insert(b, list.removeAt(a));
            _set(list);
          },
          itemBuilder: (_, i) {
            final x = s[i];
            final name = (x['heading'] as String?) ?? _sectionNames[x['key']] ?? '${x['key']}';
            return Card(
              key: ValueKey(x['key']),
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                leading: const Icon(Icons.drag_indicator),
                title: Text(name, style: TextStyle(fontWeight: FontWeight.w600, color: x['visible'] == true ? Tokens.textPrimary : Tokens.textSecondary)),
                trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                  IconButton(tooltip: 'Rename heading', icon: const Icon(Icons.edit_outlined, size: 20), onPressed: () => _rename(context, i)),
                  Switch(value: x['visible'] == true, onChanged: (v) { final list = _sections; list[i]['visible'] = v; _set(list); }),
                ]),
              ),
            );
          },
        ),
      ),
    ]);
  }
}

class _ExportTab extends StatefulWidget {
  final String resumeId, title;
  final bool saving;
  const _ExportTab({required this.resumeId, required this.title, required this.saving});
  @override
  State<_ExportTab> createState() => _ExportTabState();
}

class _ExportTabState extends State<_ExportTab> {
  String _format = 'pdf';
  String _state = 'idle'; // idle | working | done | error
  String? _error;
  bool _upgrade = false;
  String? _url;

  Future<void> _run() async {
    setState(() { _state = 'working'; _error = null; _upgrade = false; _url = null; });
    try {
      final id = await Api.instance.requestExport(widget.resumeId, _format);
      final deadline = DateTime.now().add(const Duration(minutes: 3));
      while (DateTime.now().isBefore(deadline)) {
        await Future<void>.delayed(const Duration(seconds: 2));
        if (!mounted) return;
        final s = await Api.instance.exportState(id);
        if (s['status'] == 'succeeded' && s['url'] != null) {
          setState(() { _state = 'done'; _url = Config.fixHost(s['url'] as String); });
          return;
        }
        if (s['status'] == 'failed') throw ApiException((s['error'] as String?) ?? 'The export failed. Please try again.');
      }
      throw ApiException('The document service is busy. Please try again in a moment.');
    } on ApiException catch (e) {
      if (mounted) setState(() { _state = 'error'; _error = e.message; _upgrade = e.upgrade; });
    }
  }

  Future<void> _share() async {
    final url = _url!;
    try {
      if (kIsWeb) {
        await launchUrl(Uri.parse(url));
        return;
      }
      final r = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 60));
      if (r.statusCode != 200) throw Exception('download');
      final dir = await getTemporaryDirectory();
      final safe = widget.title.replaceAll(RegExp(r'[^\w \-]'), '').trim();
      final file = File('${dir.path}/${safe.isEmpty ? 'resume' : safe}.$_format');
      await file.writeAsBytes(r.bodyBytes);
      await Share.shareXFiles([XFile(file.path, mimeType: _format == 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')], subject: widget.title);
    } catch (_) {
      if (mounted) toast(context, 'Could not download the file. Please try again.');
    }
  }

  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.all(Tokens.gutter), children: [
        const Text('Choose Format', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 10),
        for (final f in const [('pdf', 'PDF', 'Best for job applications', Icons.picture_as_pdf_outlined), ('docx', 'DOCX (Word)', 'Editable and customizable', Icons.description_outlined)])
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: InkWell(
              borderRadius: BorderRadius.circular(Tokens.rCard), onTap: () => setState(() { _format = f.$1; _state = 'idle'; }),
              child: Ink(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: _format == f.$1 ? Tokens.subtle : Tokens.surface, borderRadius: BorderRadius.circular(Tokens.rCard), border: Border.all(color: _format == f.$1 ? Tokens.brand : Tokens.border, width: _format == f.$1 ? 2 : 1)),
                child: Row(children: [Icon(f.$4, color: Tokens.brand), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(f.$2, style: const TextStyle(fontWeight: FontWeight.w700)), Text(f.$3, style: const TextStyle(color: Tokens.textSecondary))])), if (_format == f.$1) const Icon(Icons.check_circle, color: Tokens.brand)]),
              ),
            ),
          ),
        const SizedBox(height: 8),
        if (widget.saving) const Padding(padding: EdgeInsets.only(bottom: 8), child: Text('Waiting for your latest changes to save…', style: TextStyle(color: Tokens.textSecondary))),
        if (_state == 'error') Padding(padding: const EdgeInsets.only(bottom: 12), child: ErrorBanner(_error ?? 'Export failed.', onRetry: _upgrade ? null : _run, onUpgrade: _upgrade ? () => context.push('/plans') : null)),
        if (_state == 'done') ...[
          const Card(child: ListTile(leading: Icon(Icons.check_circle, color: Tokens.success), title: Text('Your file is ready'))),
          const SizedBox(height: 10),
          GradientButton(label: 'Share / Save', leading: Icons.ios_share, onPressed: _share),
        ] else
          GradientButton(label: _state == 'working' ? 'Preparing your file…' : 'Download Resume', leading: Icons.download, busy: _state == 'working', onPressed: widget.saving ? null : _run),
        const SizedBox(height: 12),
        const Text('Your document is generated on the server from the same template as the preview — real text, not a screenshot — so it stays selectable and ATS-readable.', style: TextStyle(color: Tokens.textSecondary, fontSize: 12)),
      ]);
}
