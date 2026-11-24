import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/api.dart';
import '../../core/data.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

class ResumeSummary {
  final String id, title, country, locale, templateId;
  final DateTime updatedAt;
  ResumeSummary(this.id, this.title, this.country, this.locale, this.templateId, this.updatedAt);
}

final resumesProvider = FutureProvider.autoDispose<List<ResumeSummary>>((ref) async {
  final rows = await Supabase.instance.client
      .from('resume_documents')
      .select('id,title,country_code,locale,template_id,updated_at')
      .isFilter('deleted_at', null)
      .order('updated_at', ascending: false);
  return (rows as List)
      .map((r) => ResumeSummary(r['id'], r['title'], r['country_code'], r['locale'], r['template_id'], DateTime.parse(r['updated_at'])))
      .toList();
});

final profileProvider = FutureProvider.autoDispose<LoadedProfile>((ref) => Api.instance.loadProfile());

String ago(DateTime t) {
  final d = DateTime.now().difference(t);
  if (d.inMinutes < 1) return 'just now';
  if (d.inHours < 1) return '${d.inMinutes} min ago';
  if (d.inDays < 1) return '${d.inHours} h ago';
  if (d.inDays < 30) return '${d.inDays} d ago';
  return '${t.year}-${t.month.toString().padLeft(2, '0')}-${t.day.toString().padLeft(2, '0')}';
}

class AppShell extends ConsumerStatefulWidget {
  final int tab;
  const AppShell({super.key, this.tab = 0});
  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  late int _index = widget.tab.clamp(0, 3);

  @override
  Widget build(BuildContext context) {
    final pages = [const _HomeTab(), const _ResumesTab(), const _ToolsTab(), const _ProfileTab()];
    return Scaffold(
      body: SafeArea(child: IndexedStack(index: _index, children: pages)),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.description_outlined), selectedIcon: Icon(Icons.description), label: 'Resumes'),
          NavigationDestination(icon: Icon(Icons.grid_view_outlined), selectedIcon: Icon(Icons.grid_view), label: 'Tools'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}

class _HomeTab extends ConsumerWidget {
  const _HomeTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final resumes = ref.watch(resumesProvider);
    final profile = ref.watch(profileProvider);
    final name = profile.value == null ? null : ((profile.value!.data['personal'] as Map?)?['fullName'] as String?)?.split(' ').first;
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(resumesProvider);
        ref.invalidate(profileProvider);
      },
      child: ListView(padding: const EdgeInsets.all(Tokens.gutter), children: [
        Text('Hi${name != null && name.isNotEmpty ? ', $name' : ''} 👋', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 4),
        const Text('Ready to create or update your resume?', style: TextStyle(color: Tokens.textSecondary)),
        const SizedBox(height: 16),
        InkWell(
          borderRadius: BorderRadius.circular(Tokens.rCard),
          onTap: () => context.push('/resumes/new'),
          child: Ink(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(gradient: Tokens.gradient, borderRadius: BorderRadius.circular(Tokens.rCard), boxShadow: Tokens.shadow),
            child: const Row(children: [
              CircleAvatar(backgroundColor: Colors.white24, child: Icon(Icons.add, color: Colors.white)),
              SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Create New Resume', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 17)),
                Text('Build a professional CV with AI', style: TextStyle(color: Colors.white70)),
              ])),
            ]),
          ),
        ),
        const SizedBox(height: 16),
        _toolGrid(context, resumes.value),
        Section(
          title: 'My Resumes${resumes.value == null ? '' : ' (${resumes.value!.length})'}',
          action: TextButton(onPressed: () => context.go('/home?tab=1'), child: const Text('See All')),
          children: [
            resumes.when(
              loading: () => const Padding(padding: EdgeInsets.all(24), child: Loading()),
              error: (e, _) => ErrorBanner('Could not load your resumes.', onRetry: () => ref.invalidate(resumesProvider)),
              data: (list) => list.isEmpty
                  ? const _NoResumes()
                  : Column(children: [for (final r in list.take(3)) Padding(padding: const EdgeInsets.only(bottom: 10), child: ResumeCard(r))]),
            ),
          ],
        ),
      ]),
    );
  }

  Widget _toolGrid(BuildContext context, List<ResumeSummary>? resumes) {
    void withResume(String suffix) {
      if (resumes == null || resumes.isEmpty) return toast(context, 'Create a resume first.');
      context.push('/resumes/${resumes.first.id}$suffix');
    }

    final tiles = [
      (Icons.auto_fix_high, 'AI Resume Writer', () => context.push('/ai-writer')),
      (Icons.verified_outlined, 'ATS Analysis', () => withResume('/ats')),
      (Icons.mail_outline, 'Cover Letter', () => context.push('/cover-letters')),
      (Icons.gps_fixed, 'Job Match', () => withResume('/ats')),
    ];
    return GridView.count(
      crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 2.1,
      children: [
        for (final t in tiles)
          InkWell(
            borderRadius: BorderRadius.circular(Tokens.rCard), onTap: t.$3,
            child: Ink(
              decoration: BoxDecoration(color: Tokens.surface, borderRadius: BorderRadius.circular(Tokens.rCard), border: Border.all(color: Tokens.border)),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(t.$1, color: Tokens.brand), const SizedBox(width: 8), Flexible(child: Text(t.$2, style: const TextStyle(fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis)),
              ]),
            ),
          ),
      ],
    );
  }
}

class _NoResumes extends StatelessWidget {
  const _NoResumes();
  @override
  Widget build(BuildContext context) => const Card(
        child: Padding(padding: EdgeInsets.all(20), child: Text('No resumes yet. Complete your profile once, then create a resume for any country.', style: TextStyle(color: Tokens.textSecondary))),
      );
}

class ResumeCard extends ConsumerWidget {
  final ResumeSummary r;
  const ResumeCard(this.r, {super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Card(
        child: ListTile(
          onTap: () => context.push('/resumes/${r.id}').then((_) => ref.invalidate(resumesProvider)),
          leading: Container(width: 40, height: 52, decoration: BoxDecoration(color: Tokens.subtle, borderRadius: BorderRadius.circular(8)), child: const Icon(Icons.description, color: Tokens.brand)),
          title: Text(r.title, style: const TextStyle(fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis),
          subtitle: Text('${r.country} · ${r.locale.toUpperCase()} · Updated ${ago(r.updatedAt)}'),
          trailing: PopupMenuButton<String>(
            tooltip: 'More',
            onSelected: (v) async {
              if (v == 'open') context.push('/resumes/${r.id}').then((_) => ref.invalidate(resumesProvider));
              if (v == 'delete') {
                if (!await confirm(context, title: 'Delete "${r.title}"?', body: 'This resume will be removed. Your master profile is not affected.')) return;
                try {
                  await Supabase.instance.client.from('resume_documents').update({'deleted_at': DateTime.now().toUtc().toIso8601String()}).eq('id', r.id);
                  ref.invalidate(resumesProvider);
                  if (context.mounted) toast(context, 'Resume deleted');
                } catch (_) {
                  if (context.mounted) toast(context, 'Could not delete the resume.');
                }
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'open', child: Text('Open')),
              PopupMenuItem(value: 'delete', child: Text('Delete', style: TextStyle(color: Tokens.danger))),
            ],
          ),
        ),
      );
}

class _ResumesTab extends ConsumerStatefulWidget {
  const _ResumesTab();
  @override
  ConsumerState<_ResumesTab> createState() => _ResumesTabState();
}

class _ResumesTabState extends ConsumerState<_ResumesTab> {
  String _filter = 'All';
  @override
  Widget build(BuildContext context) {
    final resumes = ref.watch(resumesProvider);
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(Tokens.gutter, Tokens.gutter, Tokens.gutter, 0),
        child: Row(children: [
          Expanded(child: Text('My Resumes', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800))),
          IconButton.filled(tooltip: 'New resume', style: IconButton.styleFrom(backgroundColor: Tokens.brand), onPressed: () => context.push('/resumes/new').then((_) => ref.invalidate(resumesProvider)), icon: const Icon(Icons.add)),
        ]),
      ),
      Padding(
        padding: const EdgeInsets.all(Tokens.gutter),
        child: Wrap(spacing: 8, children: [
          for (final f in const ['All', 'Resume', 'CV'])
            ChoiceChip(label: Text(f), selected: _filter == f, onSelected: (_) => setState(() => _filter = f), selectedColor: Tokens.brand, labelStyle: TextStyle(color: _filter == f ? Colors.white : Tokens.textPrimary)),
        ]),
      ),
      Expanded(
        child: resumes.when(
          loading: () => const Loading(),
          error: (_, __) => Padding(padding: const EdgeInsets.all(16), child: ErrorBanner('Could not load your resumes.', onRetry: () => ref.invalidate(resumesProvider))),
          data: (all) {
            // CV vs Resume follows each country's naming convention (from the backend rules).
            final docName = {for (final c in ref.watch(countriesProvider).value ?? const <Map<String, dynamic>>[]) c['countryCode'] as String: c['documentName'] as String};
            final list = all.where((r) => _filter == 'All' || (docName[r.country] ?? 'resume') == _filter.toLowerCase()).toList();
            if (list.isEmpty) {
              return EmptyState(icon: Icons.description_outlined, title: 'No resumes here', body: 'Create a resume for any country in a few taps.',
                action: GradientButton(label: 'Create resume', onPressed: () => context.push('/resumes/new').then((_) => ref.invalidate(resumesProvider))));
            }
            return RefreshIndicator(
              onRefresh: () async => ref.invalidate(resumesProvider),
              child: ListView.separated(padding: const EdgeInsets.fromLTRB(Tokens.gutter, 0, Tokens.gutter, Tokens.gutter), itemCount: list.length, separatorBuilder: (_, __) => const SizedBox(height: 10), itemBuilder: (_, i) => ResumeCard(list[i])),
            );
          },
        ),
      ),
    ]);
  }
}

class _ToolsTab extends StatelessWidget {
  const _ToolsTab();
  @override
  Widget build(BuildContext context) {
    final items = [
      (Icons.auto_fix_high, 'AI Writing Assistant', 'Write or polish your professional summary', '/ai-writer'),
      (Icons.mail_outline, 'Cover Letters', 'Generate, edit and export letters', '/cover-letters'),
      (Icons.work_outline, 'LinkedIn Assistant', 'Headline and About section', '/linkedin'),
      (Icons.workspace_premium_outlined, 'Plans & Billing', 'See what your plan includes', '/plans'),
    ];
    return ListView(padding: const EdgeInsets.all(Tokens.gutter), children: [
      Text('Tools', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
      const SizedBox(height: 12),
      for (final i in items)
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Card(child: ListTile(leading: CircleAvatar(backgroundColor: Tokens.subtle, child: Icon(i.$1, color: Tokens.brand)), title: Text(i.$2, style: const TextStyle(fontWeight: FontWeight.w600)), subtitle: Text(i.$3), trailing: const Icon(Icons.chevron_right), onTap: () => context.push(i.$4))),
        ),
      const Padding(padding: EdgeInsets.only(top: 8), child: Text('ATS analysis and job matching are inside each resume: open a resume → ATS.', style: TextStyle(color: Tokens.textSecondary))),
    ]);
  }
}

class _ProfileTab extends ConsumerWidget {
  const _ProfileTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider);
    final user = Supabase.instance.client.auth.currentUser;
    final personal = profile.value?.data['personal'] as Map?;
    return ListView(padding: const EdgeInsets.all(Tokens.gutter), children: [
      Text('Profile', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
      const SizedBox(height: 12),
      Card(
        child: ListTile(
          leading: CircleAvatar(backgroundColor: Tokens.subtle, child: Text(((personal?['fullName'] as String?) ?? user?.email ?? '?').characters.first.toUpperCase(), style: const TextStyle(color: Tokens.brand, fontWeight: FontWeight.w700))),
          title: Text((personal?['fullName'] as String?)?.isNotEmpty == true ? personal!['fullName'] as String : 'Your name', style: const TextStyle(fontWeight: FontWeight.w700)),
          subtitle: Text(user?.email ?? ''),
        ),
      ),
      const SizedBox(height: 12),
      const Text('Your master profile is entered once and reused for every resume, cover letter and AI tool. Editing it never changes a resume you have already tailored.', style: TextStyle(color: Tokens.textSecondary)),
      const SizedBox(height: 16),
      GradientButton(label: 'Edit master profile', leading: Icons.edit_outlined, onPressed: () => context.push('/profile/edit').then((_) => ref.invalidate(profileProvider))),
      const SizedBox(height: 12),
      OutlineButton(label: 'Settings', icon: Icons.settings_outlined, onPressed: () => context.push('/settings')),
    ]);
  }
}
