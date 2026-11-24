import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../core/api.dart';
import '../../core/config.dart';
import '../../core/brand.dart';
import '../../core/data.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

/// The real template rendered with the user's own data (server-side, same engine as the PDF), scaled into the card.
class _LiveThumb extends StatefulWidget {
  final String templateId, category;
  final bool selected;
  const _LiveThumb({required this.templateId, required this.category, required this.selected});
  @override
  State<_LiveThumb> createState() => _LiveThumbState();
}

class _LiveThumbState extends State<_LiveThumb> {
  WebViewController? _web;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    Api.instance.templatePreviewHtml(widget.templateId).then((html) {
      if (!mounted) return;
      setState(() => _web = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.disabled)
        ..setBackgroundColor(Colors.white)
        ..loadHtmlString(html, baseUrl: Config.apiBase));
    }).catchError((_) {
      if (mounted) setState(() => _failed = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final border = Border.all(color: widget.selected ? Tokens.brand : Tokens.border, width: widget.selected ? 2.5 : 1);
    if (_failed) return TemplateThumb(category: widget.category, selected: widget.selected);
    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: border, boxShadow: Tokens.shadow),
      clipBehavior: Clip.antiAlias,
      child: _web == null ? const Center(child: SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))) : IgnorePointer(child: WebViewWidget(controller: _web!)),
    );
  }
}

String _cap(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1).replaceAll(RegExp('[-_]'), ' ');

/// Template gallery: search, category chips, selectable grid, "Use This Template" → new-resume flow with the template preselected.
class TemplatesTab extends ConsumerStatefulWidget {
  const TemplatesTab({super.key});
  @override
  ConsumerState<TemplatesTab> createState() => _TemplatesTabState();
}

class _TemplatesTabState extends ConsumerState<TemplatesTab> {
  final _q = TextEditingController();
  String _cat = 'All';
  String? _selected;

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(templatesProvider);
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(Tokens.gutter, Tokens.gutter, Tokens.gutter, 8),
        child: Column(children: [
          Text('Templates', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800, color: Tokens.navy)),
          const SizedBox(height: 12),
          TextField(controller: _q, onChanged: (_) => setState(() {}), decoration: const InputDecoration(hintText: 'Search templates…', prefixIcon: Icon(Icons.search))),
        ]),
      ),
      Expanded(
        child: data.when(
          loading: () => const Loading(),
          error: (_, __) => Padding(padding: const EdgeInsets.all(16), child: ErrorBanner('Could not load templates.', onRetry: () => ref.invalidate(templatesProvider))),
          data: (d) {
            final cats = ['All', ...((d['categories'] as List).cast<String>())];
            final q = _q.text.trim().toLowerCase();
            final list = (d['templates'] as List).cast<Map>().where((t) => (_cat == 'All' || t['category'] == _cat) && (q.isEmpty || (t['name'] as String).toLowerCase().contains(q) || (t['category'] as String).toLowerCase().contains(q))).toList();
            return Column(children: [
              SizedBox(
                height: 44,
                child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: Tokens.gutter), children: [
                  for (final c in cats)
                    Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(label: Text(_cap(c)), selected: _cat == c, onSelected: (_) => setState(() => _cat = c), selectedColor: Tokens.brand, labelStyle: TextStyle(color: _cat == c ? Colors.white : Tokens.textPrimary, fontWeight: FontWeight.w600), showCheckmark: false)),
                ]),
              ),
              Expanded(
                child: list.isEmpty
                    ? const EmptyState(icon: Icons.search_off, title: 'No templates found', body: 'Try another search or category.')
                    : GridView.builder(
                        padding: const EdgeInsets.all(Tokens.gutter),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 14, crossAxisSpacing: 14, childAspectRatio: .72),
                        itemCount: list.length,
                        itemBuilder: (_, i) {
                          final t = list[i];
                          final id = t['id'] as String;
                          final sel = _selected == id;
                          return Semantics(
                            button: true, selected: sel, label: '${t['name']} template${t['premium'] == true ? ', premium' : ''}',
                            child: InkWell(
                              borderRadius: BorderRadius.circular(12),
                              onTap: () => setState(() => _selected = id),
                              child: Column(children: [
                                Expanded(child: Stack(children: [
                                  Positioned.fill(child: _LiveThumb(templateId: id, category: t['category'] as String, selected: sel)),
                                  if (sel) const Positioned(top: 8, right: 8, child: CircleAvatar(radius: 12, backgroundColor: Tokens.brand, child: Icon(Icons.check, size: 16, color: Colors.white))),
                                  if (t['premium'] == true) Positioned(top: 8, left: 8, child: Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: Tokens.navy, borderRadius: BorderRadius.circular(6)), child: const Text('PRO', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800)))),
                                ])),
                                const SizedBox(height: 6),
                                Text(t['name'] as String, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, color: Tokens.navy)),
                              ]),
                            ),
                          );
                        },
                      ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(Tokens.gutter, 0, Tokens.gutter, Tokens.gutter),
                child: GradientButton(label: 'Use This Template', onPressed: _selected == null ? null : () => context.push('/resumes/new?template=${Uri.encodeQueryComponent(_selected!)}')),
              ),
            ]);
          },
        ),
      ),
    ]);
  }
}
