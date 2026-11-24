import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/api.dart';
import '../../core/data.dart';
import '../../core/theme.dart';
import '../../core/brand.dart';
import '../../core/widgets.dart';
import '../templates/templates_tab.dart';
import '../jobs/jobs_screen.dart';

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

/// Pages: 0 Home · 1 Templates · 2 Jobs · 3 Profile. The centre "+" in the bar starts a new resume (not a page).
class _AppShellState extends ConsumerState<AppShell> {
  late int _index = widget.tab.clamp(0, 3);

  @override
  void didUpdateWidget(AppShell old) {
    super.didUpdateWidget(old);
    if (old.tab != widget.tab) _index = widget.tab.clamp(0, 3);
  }

  @override
  Widget build(BuildContext context) {
    final pages = [const _HomeTab(), const TemplatesTab(), const JobsTab(), const _ProfileTab()];
    Widget item(int page, IconData icon, IconData active, String label) {
      final on = _index == page;
      return Expanded(
        child: InkWell(
          onTap: () => setState(() => _index = page),
          child: Semantics(
            selected: on, button: true, label: label, excludeSemantics: true,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Icon(on ? active : icon, color: on ? Tokens.brand : Tokens.textSecondary),
                const SizedBox(height: 2),
                Text(label, style: TextStyle(fontSize: 11.5, fontWeight: on ? FontWeight.w700 : FontWeight.w500, color: on ? Tokens.brand : Tokens.textSecondary)),
              ]),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      body: SafeArea(child: IndexedStack(index: _index, children: pages)),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(color: Tokens.surface, boxShadow: [BoxShadow(color: Tokens.navy.withOpacity(.08), blurRadius: 16, offset: const Offset(0, -4))], borderRadius: const BorderRadius.vertical(top: Radius.circular(24))),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 64,
            child: Row(children: [
              item(0, Icons.home_outlined, Icons.home, 'Home'),
              item(1, Icons.grid_view_outlined, Icons.grid_view, 'Templates'),
              Expanded(
                child: Center(
                  child: Semantics(
                    button: true, label: 'Create new resume',
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: () => context.push('/resumes/new').then((_) => ref.invalidate(resumesProvider)),
                      child: Container(width: 52, height: 52, decoration: BoxDecoration(gradient: Tokens.gradient, shape: BoxShape.circle, boxShadow: Tokens.shadow), child: const Icon(Icons.add, color: Colors.white, size: 30)),
                    ),
                  ),
                ),
              ),
              item(2, Icons.work_outline, Icons.work, 'Jobs'),
              item(3, Icons.person_outline, Icons.person, 'Profile'),
            ]),
          ),
        ),
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
        Row(children: [
          const RimbersLogo(size: 34),
          const Spacer(),
          InkWell(
            customBorder: const CircleBorder(),
            onTap: () => context.go('/home?tab=3'),
            child: Semantics(label: 'Profile', button: true, child: CircleAvatar(backgroundColor: Tokens.subtle, child: Text((name ?? '?').characters.first.toUpperCase(), style: const TextStyle(color: Tokens.brand, fontWeight: FontWeight.w800)))),
          ),
        ]),
        const SizedBox(height: 18),
        Text('Hello${name != null && name.isNotEmpty ? ', $name' : ''} 👋', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800, color: Tokens.navy)),
        const SizedBox(height: 2),
        const Text('Let’s create your perfect resume', style: TextStyle(color: Tokens.textSecondary, fontSize: 15)),
        const SizedBox(height: 16),
        InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: () => context.push('/resumes/new'),
          child: Ink(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(gradient: const LinearGradient(colors: [Color(0xFF0B2A7A), Color(0xFF1F5FE0)], begin: Alignment.topLeft, end: Alignment.bottomRight), borderRadius: BorderRadius.circular(22), boxShadow: Tokens.shadow),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: const [
                  Icon(Icons.auto_awesome, color: Colors.white70),
                  SizedBox(height: 8),
                  Text('Create Resume with AI', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 19)),
                  SizedBox(height: 4),
                  Text('Generate, optimize and tailor your resume with the power of AI.', style: TextStyle(color: Colors.white70, height: 1.35)),
                ]),
              ),
              const SizedBox(width: 12),
              Column(children: [
                Container(width: 64, height: 64, decoration: const BoxDecoration(color: Colors.white12, shape: BoxShape.circle), child: const Icon(Icons.smart_toy_outlined, color: Colors.white, size: 38)),
                const SizedBox(height: 10),
                const CircleAvatar(radius: 16, backgroundColor: Colors.white, child: Icon(Icons.arrow_forward, size: 18, color: Tokens.brand)),
              ]),
            ]),
          ),
        ),
        const SizedBox(height: 16),
        _toolGrid(context, resumes.value),
        Align(alignment: Alignment.centerRight, child: TextButton(onPressed: () => context.push('/tools'), child: const Text('All tools →'))),
        Section(
          title: 'Your Resumes',
          action: TextButton(onPressed: () => context.push('/resumes').then((_) => ref.invalidate(resumesProvider)), child: const Text('See All →')),
          children: [
            resumes.when(
              loading: () => const Padding(padding: EdgeInsets.all(24), child: Loading()),
              error: (e, _) => ErrorBanner('Could not load your resumes.', onRetry: () => ref.invalidate(resumesProvider)),
              data: (list) => list.isEmpty
                  ? const _NoResumes()
                  : Column(children: [for (final r in list.take(3)) Padding(padding: const EdgeInsets.only(bottom: 10), child: ResumeCard(r))]),
            ),
            OutlineButton(label: 'Create New Resume', icon: Icons.add, onPressed: () => context.push('/resumes/new').then((_) => ref.invalidate(resumesProvider))),
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

    final tiles = <(IconData, String, VoidCallback?, String?)>[
      (Icons.bar_chart_rounded, 'ATS Analyzer', () => withResume('/ats'), null),
      (Icons.mail_outline, 'Cover Letter', () => context.push('/cover-letters'), null),
      (Icons.forum_outlined, 'Interview Prep', null, 'Soon'),
      (Icons.work_outline, 'Job Search', () => context.go('/home?tab=2'), null),
    ];
    return GridView.count(
      crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 1.9,
      children: [
        for (final t in tiles)
          Opacity(
            opacity: t.$3 == null ? .6 : 1,
            child: InkWell(
              borderRadius: BorderRadius.circular(Tokens.rCard), onTap: t.$3,
              child: Ink(
                decoration: BoxDecoration(color: Tokens.surface, borderRadius: BorderRadius.circular(Tokens.rCard), border: Border.all(color: Tokens.border), boxShadow: Tokens.shadow),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(t.$1, color: Tokens.brand, size: 30),
                  const SizedBox(height: 6),
                  Text(t.$4 == null ? t.$2 : '${t.$2} · ${t.$4}', style: const TextStyle(fontWeight: FontWeight.w600, color: Tokens.navy), overflow: TextOverflow.ellipsis),
                ]),
              ),
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

class ToolsScreen extends StatelessWidget {
  const ToolsScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Tools')), body: const _ToolsList());
}

class _ToolsList extends StatelessWidget {
  const _ToolsList();
  @override
  Widget build(BuildContext context) {
    final items = [
      (Icons.auto_fix_high, 'AI Writing Assistant', 'Write or polish your professional summary', '/ai-writer'),
      (Icons.mail_outline, 'Cover Letters', 'Generate, edit and export letters', '/cover-letters'),
      (Icons.forum_outlined, 'Community', 'Wins, questions and resume feedback', '/community'),
      (Icons.work_outline, 'LinkedIn Assistant', 'Headline and About section', '/linkedin'),
      (Icons.workspace_premium_outlined, 'Plans & Billing', 'See what your plan includes', '/plans'),
    ];
    return ListView(padding: const EdgeInsets.all(Tokens.gutter), children: [
      for (final i in items)
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Card(child: ListTile(leading: CircleAvatar(backgroundColor: Tokens.subtle, child: Icon(i.$1, color: Tokens.brand)), title: Text(i.$2, style: const TextStyle(fontWeight: FontWeight.w600)), subtitle: Text(i.$3), trailing: const Icon(Icons.chevron_right), onTap: () => context.push(i.$4))),
        ),
      const Padding(padding: EdgeInsets.only(top: 8), child: Text('ATS analysis and job matching are inside each resume: open a resume → ATS.', style: TextStyle(color: Tokens.textSecondary))),
    ]);
  }
}

class ResumesScreen extends StatelessWidget {
  const ResumesScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(), body: const _ResumesTab());
}

class _ProfileTab extends ConsumerWidget {
  const _ProfileTab();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider);
    final plan = ref.watch(planProvider);
    final resumes = ref.watch(resumesProvider);
    final saved = ref.watch(pipelineProvider('saved'));
    final user = Supabase.instance.client.auth.currentUser;
    final personal = profile.value?.data['personal'] as Map?;
    final fullName = (personal?['fullName'] as String?) ?? '';
    final planId = plan.value?['plan'] as String? ?? 'FREE';
    final planName = const {'FREE': 'Free', 'STANDARD': 'Standard', 'PROFESSIONAL': 'Professional', 'PREMIUM': 'Premium'}[planId] ?? planId;

    Widget row(IconData icon, String label, {String? trailing, VoidCallback? onTap, Color? color}) => ListTile(
          leading: Icon(icon, color: color ?? Tokens.navy), title: Text(label, style: TextStyle(fontWeight: FontWeight.w600, color: color ?? Tokens.navy)),
          trailing: trailing != null ? Text(trailing, style: const TextStyle(color: Tokens.textSecondary)) : const Icon(Icons.chevron_right), onTap: onTap);

    return ListView(padding: const EdgeInsets.all(Tokens.gutter), children: [
      Align(alignment: Alignment.centerRight, child: IconButton(tooltip: 'Settings', icon: const Icon(Icons.settings_outlined), onPressed: () => context.push('/settings'))),
      Center(child: CircleAvatar(radius: 44, backgroundColor: Tokens.subtle, child: Text((fullName.isNotEmpty ? fullName : (user?.email ?? '?')).characters.first.toUpperCase(), style: const TextStyle(fontSize: 34, color: Tokens.brand, fontWeight: FontWeight.w800)))),
      const SizedBox(height: 10),
      Center(child: Text(fullName.isNotEmpty ? fullName : 'Your name', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Tokens.navy))),
      Center(child: Text(user?.email ?? '', style: const TextStyle(color: Tokens.textSecondary))),
      const SizedBox(height: 8),
      Center(child: Chip(avatar: const Icon(Icons.workspace_premium, size: 18, color: Tokens.brand), label: Text('$planName Plan', style: const TextStyle(fontWeight: FontWeight.w700)))),
      const SizedBox(height: 12),
      if (planId == 'FREE')
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(gradient: const LinearGradient(colors: [Color(0xFF0B2A7A), Color(0xFF1F5FE0)]), borderRadius: BorderRadius.circular(20)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Upgrade your plan', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18)),
            const SizedBox(height: 4),
            const Text('Compare what each plan includes — more resumes, AI requests and downloads.', style: TextStyle(color: Colors.white70)),
            const SizedBox(height: 12),
            FilledButton(style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: Tokens.brand), onPressed: () => context.push('/plans'), child: const Text('See plans →')),
          ]),
        ),
      const SizedBox(height: 12),
      Card(
        child: Column(children: [
          row(Icons.description_outlined, 'My Resumes', trailing: resumes.value == null ? null : '${resumes.value!.length}', onTap: () => context.push('/resumes').then((_) => ref.invalidate(resumesProvider))),
          row(Icons.bookmark_border, 'Saved Jobs', trailing: saved.value == null ? null : '${saved.value!.items.length}', onTap: () => context.go('/home?tab=2')),
          row(Icons.edit_outlined, 'Edit master profile', onTap: () => context.push('/profile/edit').then((_) => ref.invalidate(profileProvider))),
          row(Icons.forum_outlined, 'Community', onTap: () => context.push('/community')),
          row(Icons.grid_view, 'All tools', onTap: () => context.push('/tools')),
          row(Icons.settings_outlined, 'Settings', onTap: () => context.push('/settings')),
          row(Icons.logout, 'Log Out', color: Tokens.danger, onTap: () async {
            if (!await confirm(context, title: 'Log out?', body: 'You can sign back in any time.', action: 'Log out')) return;
            await Supabase.instance.client.auth.signOut();
          }),
        ]),
      ),
    ]);
  }
}
