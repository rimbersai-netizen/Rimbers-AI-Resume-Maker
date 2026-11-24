import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api.dart';
import '../../core/jobs_api.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import '../home/shell.dart' show ago;

const applicationStates = ['ready', 'applying', 'needs_you', 'applied', 'interview', 'offer', 'rejected'];
const stateLabels = {
  'saved': 'Saved', 'ready': 'Ready to apply', 'applying': 'Applying', 'applied': 'Applied', 'needs_you': 'Needs you', 'interview': 'Interview', 'offer': 'Offer', 'rejected': 'Rejected',
};

final pipelineProvider = FutureProvider.autoDispose.family<({List<PipelineItem> items, Map<String, int> counts}), String>((ref, states) => Api.instance.pipeline(states.split(',')));

Color labelColor(String label) => label == 'strong' ? Tokens.success : (label == 'good' ? const Color(0xFFB7791F) : Tokens.danger);

/// Red → amber → green bar with a marker, plus an accessible label.
class MatchBar extends StatelessWidget {
  final JobMatch match;
  const MatchBar(this.match, {super.key});
  @override
  Widget build(BuildContext context) => Semantics(
        label: 'Estimated match ${match.score} out of 100, ${match.labelText}',
        excludeSemantics: true,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text('${match.score}', style: const TextStyle(fontSize: 38, fontWeight: FontWeight.w800, height: 1)),
            const SizedBox(width: 10),
            Flexible(child: Text(match.labelText, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: labelColor(match.label), fontWeight: FontWeight.w700))),
            const Spacer(),
            const Text('of 100', style: TextStyle(color: Tokens.textSecondary, fontSize: 12)),
          ]),
          const SizedBox(height: 8),
          LayoutBuilder(builder: (_, c) {
            final x = (c.maxWidth * match.score / 100).clamp(7.0, c.maxWidth - 7);
            return SizedBox(
              height: 14,
              child: Stack(clipBehavior: Clip.none, children: [
                Positioned.fill(
                  top: 3, bottom: 3,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(99),
                    child: Row(children: const [
                      Expanded(flex: 50, child: ColoredBox(color: Color(0xFFD9534F), child: SizedBox.expand())),
                      Expanded(flex: 25, child: ColoredBox(color: Color(0xFFE0A33A), child: SizedBox.expand())),
                      Expanded(flex: 25, child: ColoredBox(color: Color(0xFF2FAE6B), child: SizedBox.expand())),
                    ]),
                  ),
                ),
                Positioned(left: x - 7, top: 0, child: Container(width: 14, height: 14, decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, border: Border.all(color: Tokens.textPrimary, width: 2)))),
              ]),
            );
          }),
        ]),
      );
}

class CompanyLogo extends StatelessWidget {
  final String? url;
  final String name;
  final double size;
  const CompanyLogo(this.url, this.name, {super.key, this.size = 44});
  @override
  Widget build(BuildContext context) {
    final ph = Container(width: size, height: size, alignment: Alignment.center, decoration: BoxDecoration(color: Tokens.subtle, borderRadius: BorderRadius.circular(12)),
        child: Text(name.isEmpty ? '?' : name[0].toUpperCase(), style: const TextStyle(color: Tokens.brand, fontWeight: FontWeight.w800, fontSize: 18)));
    if (url == null) return ph;
    return ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.network(url!, width: size, height: size, fit: BoxFit.cover, errorBuilder: (_, __, ___) => ph));
  }
}

Future<void> openUrl(BuildContext context, String url) async {
  final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication).catchError((_) => false);
  if (!ok && context.mounted) toast(context, 'Could not open the link.');
}

class JobsTab extends ConsumerStatefulWidget {
  const JobsTab({super.key});
  @override
  ConsumerState<JobsTab> createState() => _JobsTabState();
}

class _JobsTabState extends ConsumerState<JobsTab> {
  int _seg = 0;
  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(Tokens.gutter, Tokens.gutter, 4, 0),
        child: Row(children: [
          Expanded(child: Text(const ['Discover', 'Job Search', 'Saved', 'Applications'][_seg], style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800))),
          IconButton(tooltip: 'Job preferences', icon: const Icon(Icons.tune), onPressed: () => context.push('/jobs/preferences').then((_) => setState(() => _seg = 0))),
        ]),
      ),
      Padding(
        padding: const EdgeInsets.all(Tokens.gutter),
        child: SegmentedButton<int>(
          showSelectedIcon: false,
          segments: const [
            ButtonSegment(value: 0, label: Text('Swipe')),
            ButtonSegment(value: 1, label: Text('Search')),
            ButtonSegment(value: 2, label: Text('Saved')),
            ButtonSegment(value: 3, label: Text('Applied')),
          ],
          selected: {_seg},
          onSelectionChanged: (s) => setState(() => _seg = s.first),
        ),
      ),
      Expanded(child: IndexedStack(index: _seg, children: [DiscoverView(active: _seg == 0), const BrowseView(), PipelineView(key: ValueKey('saved$_seg'), states: const ['saved'], saved: true), PipelineView(key: ValueKey('apps$_seg'), states: applicationStates)])),
    ]);
  }
}

// ---------------------------------------------------------------- Discover

class DiscoverView extends ConsumerStatefulWidget {
  final bool active;
  const DiscoverView({super.key, required this.active});
  @override
  ConsumerState<DiscoverView> createState() => _DiscoverViewState();
}

class _DiscoverViewState extends ConsumerState<DiscoverView> {
  final List<Job> _queue = [];
  int _remaining = 0;
  bool _loading = true, _busy = false, _profileReady = true;
  String? _error;
  ({Job job, String id, String verb})? _last;
  double _dx = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final f = await Api.instance.jobFeed();
      if (!f.prefsSaved && mounted) {
        context.push('/jobs/preferences').then((_) => _load());
        return;
      }
      _queue..clear()..addAll(f.jobs);
      _remaining = math.max(0, f.total - f.jobs.length);
      _profileReady = f.profileReady;
    } on ApiException catch (e) {
      _error = e.message;
    } catch (_) {
      _error = 'Could not load jobs. Please try again.'; // never show raw Dart errors
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _refill() async {
    if (_remaining <= 0) return;
    try {
      final f = await Api.instance.jobFeed(offset: _queue.length);
      final have = _queue.map((j) => j.key).toSet();
      _queue.addAll(f.jobs.where((j) => !have.contains(j.key)));
      _remaining = math.max(0, f.total - _queue.length);
      if (mounted) setState(() {});
    } catch (_) {}
  }

  Future<void> _act(String state, String verb) async {
    if (_queue.isEmpty || _busy) return;
    final job = _queue.first;
    setState(() { _busy = true; _dx = 0; });
    try {
      final item = await Api.instance.setJobState(job.key, state);
      _queue.removeAt(0);
      _last = (job: job, id: item.id, verb: verb);
      if (_queue.length <= 5) _refill();
      ref.invalidate(pipelineProvider);
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message);
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _undo() async {
    final l = _last;
    if (l == null || _busy) return;
    setState(() => _busy = true);
    try {
      await Api.instance.removePipeline(l.id);
      _queue.insert(0, l.job);
      _last = null;
      ref.invalidate(pipelineProvider);
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message);
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Loading();
    if (_error != null) return Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(_error!, onRetry: _load));
    if (_queue.isEmpty) {
      return EmptyState(icon: Icons.check_circle_outline, title: 'You’re all caught up', body: 'No more listings match your preferences right now. Widen your preferences or check back later.',
          action: Column(mainAxisSize: MainAxisSize.min, children: [
            if (_last != null) TextButton.icon(onPressed: _undo, icon: const Icon(Icons.undo), label: const Text('Undo last')),
            OutlineButton(label: 'Change preferences', onPressed: () => context.push('/jobs/preferences').then((_) => _load())),
          ]));
    }
    final job = _queue.first;
    return Column(children: [
      if (!_profileReady)
        Padding(
          padding: const EdgeInsets.fromLTRB(Tokens.gutter, 0, Tokens.gutter, 8),
          child: Card(child: ListTile(dense: true, leading: const Icon(Icons.info_outline, color: Tokens.brand), title: const Text('Complete your profile for accurate scores'), trailing: const Icon(Icons.chevron_right), onTap: () => context.push('/profile/edit'))),
        ),
      Expanded(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: Tokens.gutter),
          child: GestureDetector(
            onHorizontalDragUpdate: (d) => setState(() => _dx += d.delta.dx),
            onHorizontalDragEnd: (_) {
              if (_dx > 110) { _act('ready', 'Added to applications'); } else if (_dx < -110) { _act('passed', 'Passed'); } else { setState(() => _dx = 0); }
            },
            child: AnimatedContainer(
              duration: _dx == 0 ? const Duration(milliseconds: 200) : Duration.zero,
              transform: Matrix4.translationValues(_dx, 0, 0)..rotateZ(_dx / 1200),
              transformAlignment: Alignment.bottomCenter,
              child: Stack(children: [
                _JobCard(job: job, onDetails: () => showJobDetails(context, job)),
                if (_dx > 40) const Positioned(top: 18, left: 18, child: _Stamp('ADD', Tokens.success)),
                if (_dx < -40) const Positioned(top: 18, right: 18, child: _Stamp('PASS', Tokens.danger)),
              ]),
            ),
          ),
        ),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          _Round(Icons.undo, 'Undo last action', _last == null || _busy ? null : _undo),
          const SizedBox(width: 14),
          _Round(Icons.close, 'Pass', _busy ? null : () => _act('passed', 'Passed'), color: Tokens.danger),
          const SizedBox(width: 14),
          _Round(Icons.bookmark_border, 'Save for later', _busy ? null : () => _act('saved', 'Saved')),
          const SizedBox(width: 14),
          _Round(Icons.favorite, 'Add to my applications', _busy ? null : () => _act('ready', 'Added to applications'), filled: true, size: 60),
        ]),
      ),
      Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(_last == null ? 'Swipe right to add · left to pass' : '${_last!.verb}: ${_last!.job.title}', style: const TextStyle(color: Tokens.textSecondary, fontSize: 12), textAlign: TextAlign.center)),
    ]);
  }

}

void showJobDetails(BuildContext context, Job job) {
  showModalBottomSheet(
    context: context, isScrollControlled: true, showDragHandle: true, backgroundColor: Tokens.surface,
    builder: (_) => DraggableScrollableSheet(
      expand: false, initialChildSize: .8, maxChildSize: .95,
      builder: (_, sc) => ListView(controller: sc, padding: const EdgeInsets.fromLTRB(20, 0, 20, 24), children: [
        Text(job.title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 4),
        Text('${job.company} · ${job.location}', style: const TextStyle(color: Tokens.textSecondary)),
        const SizedBox(height: 14),
        Text(job.description.isEmpty ? 'No description provided.' : job.description, style: const TextStyle(height: 1.45)),
        const SizedBox(height: 16),
        Text('via ${job.sourceName}', style: const TextStyle(color: Tokens.textSecondary, fontSize: 12)),
        const SizedBox(height: 8),
        OutlineButton(label: 'View original posting', onPressed: () => openUrl(context, job.url)),
      ]),
    ),
  );
}

class _Stamp extends StatelessWidget {
  final String text;
  final Color color;
  const _Stamp(this.text, this.color);
  @override
  Widget build(BuildContext context) => Transform.rotate(angle: -.14, child: Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4), decoration: BoxDecoration(border: Border.all(color: color, width: 3), borderRadius: BorderRadius.circular(8)), child: Text(text, style: TextStyle(color: color, fontWeight: FontWeight.w800, letterSpacing: 2))));
}

class _Round extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback? onTap;
  final bool filled;
  final Color? color;
  final double size;
  const _Round(this.icon, this.tooltip, this.onTap, {this.filled = false, this.color, this.size = 52});
  @override
  Widget build(BuildContext context) => Tooltip(
        message: tooltip,
        child: Material(
          color: filled ? (onTap == null ? Tokens.danger.withOpacity(.4) : Tokens.danger) : Tokens.surface,
          shape: CircleBorder(side: BorderSide(color: filled ? Colors.transparent : Tokens.border)),
          elevation: 2,
          child: InkWell(customBorder: const CircleBorder(), onTap: onTap, child: SizedBox(width: size, height: size, child: Icon(icon, color: filled ? Colors.white : (onTap == null ? Tokens.border : (color ?? Tokens.textPrimary))))),
        ),
      );
}

class _JobCard extends StatelessWidget {
  final Job job;
  final VoidCallback onDetails;
  const _JobCard({required this.job, required this.onDetails});
  @override
  Widget build(BuildContext context) {
    final m = job.match!;
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(color: Tokens.surface, borderRadius: BorderRadius.circular(22), border: Border.all(color: Tokens.border), boxShadow: Tokens.shadow),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(22),
        child: ListView(padding: const EdgeInsets.all(18), children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            CompanyLogo(job.logo, job.company),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(job.company.toUpperCase(), style: const TextStyle(fontSize: 11, letterSpacing: 1, fontWeight: FontWeight.w600, color: Tokens.textSecondary)),
              const SizedBox(height: 2),
              Text(job.title, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text([job.salaryText, job.location, job.jobType, ago(job.postedAt)].where((e) => e != null && e.isNotEmpty).join(' · '), style: const TextStyle(color: Tokens.textSecondary, fontSize: 12.5)),
            ])),
          ]),
          const SizedBox(height: 16),
          MatchBar(m),
          if (m.requiredYears != null || m.profileYears > 0)
            Padding(padding: const EdgeInsets.only(top: 6), child: Text('${m.requiredYears != null ? 'Asks for ${m.requiredYears}+ years' : 'Years not stated'} · you have ${m.profileYears} on your profile', style: const TextStyle(color: Tokens.textSecondary, fontSize: 12))),
          const SizedBox(height: 14),
          const _Cap('ON YOUR RESUME'),
          Wrap(spacing: 6, runSpacing: 6, children: m.matched.isEmpty ? [const Text('No listed skills found on your profile.', style: TextStyle(color: Tokens.textSecondary, fontSize: 13))] : [for (final s in m.matched) _Skill(s.label, true)]),
          if (m.missing.isNotEmpty) ...[const SizedBox(height: 12), const _Cap('TO GROW'), Wrap(spacing: 6, runSpacing: 6, children: [for (final s in m.missing) _Skill(s.required ? '${s.label} *' : s.label, false)])],
          const SizedBox(height: 14),
          if (job.description.isNotEmpty) Text(job.description.length > 220 ? '${job.description.substring(0, 220)}…' : job.description, style: const TextStyle(color: Tokens.textSecondary, height: 1.4)),
          TextButton(onPressed: onDetails, style: TextButton.styleFrom(alignment: Alignment.centerLeft, padding: EdgeInsets.zero), child: const Text('Read the role')),
          Text('via ${job.sourceName}', style: const TextStyle(color: Tokens.textSecondary, fontSize: 11.5)),
        ]),
      ),
    );
  }
}

class _Cap extends StatelessWidget {
  final String t;
  const _Cap(this.t);
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(t, style: const TextStyle(fontSize: 11, letterSpacing: 1, fontWeight: FontWeight.w700, color: Tokens.textSecondary)));
}

class _Skill extends StatelessWidget {
  final String label;
  final bool have;
  const _Skill(this.label, this.have);
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(color: have ? const Color(0xFFE4F6EA) : Tokens.subtle, borderRadius: BorderRadius.circular(99)),
        child: Text(have ? '✓ $label' : label, style: TextStyle(fontSize: 12.5, color: have ? const Color(0xFF17693A) : Tokens.textPrimary)),
      );
}

// ---------------------------------------------------------------- Saved + Applications

class PipelineView extends ConsumerWidget {
  final List<String> states;
  final bool saved;
  const PipelineView({super.key, required this.states, this.saved = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final q = ref.watch(pipelineProvider(states.join(',')));
    return q.when(
      loading: () => const Loading(),
      error: (e, _) => Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(e is ApiException ? e.message : 'Could not load your jobs.', onRetry: () => ref.invalidate(pipelineProvider))),
      data: (d) {
        if (d.items.isEmpty) {
          return EmptyState(
            icon: saved ? Icons.bookmark_border : Icons.send_outlined,
            title: saved ? 'Nothing saved yet' : 'No applications yet',
            body: saved ? 'Tap the bookmark on a job in Discover to keep it here.' : 'Add jobs from Discover, tailor your resume, then apply on the employer’s page and update the status here.');
        }
        final order = saved ? ['saved'] : states;
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(pipelineProvider),
          child: ListView(padding: const EdgeInsets.fromLTRB(Tokens.gutter, 0, Tokens.gutter, Tokens.gutter), children: [
            if (!saved) const Padding(padding: EdgeInsets.only(bottom: 8), child: Text('You submit each application yourself on the employer’s page, then update its status here.', style: TextStyle(color: Tokens.textSecondary, fontSize: 12.5))),
            for (final st in order)
              if (d.items.any((i) => i.state == st)) ...[
                Padding(padding: const EdgeInsets.only(top: 12, bottom: 8), child: Text('${stateLabels[st]} (${d.items.where((i) => i.state == st).length})', style: const TextStyle(fontWeight: FontWeight.w700))),
                for (final it in d.items.where((i) => i.state == st)) Padding(padding: const EdgeInsets.only(bottom: 10), child: _PipelineTile(it, saved: saved)),
              ],
          ]),
        );
      },
    );
  }
}

class _PipelineTile extends ConsumerWidget {
  final PipelineItem it;
  final bool saved;
  const _PipelineTile(this.it, {required this.saved});

  Future<void> _set(BuildContext context, WidgetRef ref, String state) async {
    try {
      await Api.instance.setJobState(it.key, state);
      ref.invalidate(pipelineProvider);
    } on ApiException catch (e) {
      if (context.mounted) toast(context, e.message);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            CompanyLogo(it.logo, it.company, size: 40),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(it.title, style: const TextStyle(fontWeight: FontWeight.w700), maxLines: 2, overflow: TextOverflow.ellipsis),
              Text('${it.company}${it.location != null ? ' · ${it.location}' : ''} · ${it.state == 'applied' && it.appliedAt != null ? 'applied ${ago(it.appliedAt!)}' : 'updated ${ago(it.updatedAt)}'}', style: const TextStyle(color: Tokens.textSecondary, fontSize: 12)),
            ])),
            if (it.matchScore != null) Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4), decoration: BoxDecoration(color: Tokens.subtle, borderRadius: BorderRadius.circular(99)), child: Text('${it.matchScore}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12))),
          ]),
          const SizedBox(height: 8),
          Wrap(spacing: 4, runSpacing: 0, crossAxisAlignment: WrapCrossAlignment.center, children: [
            TextButton(onPressed: () => context.push('/jobs/tailor?key=${Uri.encodeQueryComponent(it.key)}').then((_) => ref.invalidate(pipelineProvider)), child: Text(it.tailoredResumeId != null ? 'Tailor again' : 'Tailor resume')),
            if (it.tailoredResumeId != null) TextButton(onPressed: () => context.push('/resumes/${it.tailoredResumeId}'), child: const Text('Open resume')),
            if (it.url != null && it.state != 'applied')
              TextButton(onPressed: () async { await openUrl(context, it.url!); if (it.state == 'ready' || it.state == 'saved') _set(context, ref, 'applying'); }, child: const Text('Apply on site')),
            if (saved) TextButton(onPressed: () => _set(context, ref, 'ready'), child: const Text('Add to applications')),
            if (!saved)
              PopupMenuButton<String>(
                tooltip: 'Change status',
                onSelected: (s) => _set(context, ref, s),
                itemBuilder: (_) => [for (final s in applicationStates) PopupMenuItem(value: s, child: Text(stateLabels[s]!))],
                child: const Padding(padding: EdgeInsets.symmetric(horizontal: 8, vertical: 10), child: Row(mainAxisSize: MainAxisSize.min, children: [Text('Status'), Icon(Icons.arrow_drop_down)])),
              ),
            TextButton(
              onPressed: () async {
                if (!await confirm(context, title: 'Remove "${it.title}"?', body: 'It will be removed from your list.', action: 'Remove')) return;
                try { await Api.instance.removePipeline(it.id); ref.invalidate(pipelineProvider); } on ApiException catch (e) { if (context.mounted) toast(context, e.message); }
              },
              child: const Text('Remove', style: TextStyle(color: Tokens.danger)),
            ),
          ]),
        ]),
      ),
    );
  }
}

// ---------------------------------------------------------------- Browse (search + filters list)

class BrowseView extends ConsumerStatefulWidget {
  const BrowseView({super.key});
  @override
  ConsumerState<BrowseView> createState() => _BrowseViewState();
}

class _BrowseViewState extends ConsumerState<BrowseView> {
  final _q = TextEditingController();
  final List<Job> _jobs = [];
  int _total = 0;
  bool _loading = true, _more = false, _remote = false, _fullTime = false, _strong = false;
  String? _error;
  final _saved = <String>{};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  Future<void> _load({bool more = false}) async {
    setState(() { if (more) { _more = true; } else { _loading = true; _error = null; } });
    try {
      final f = await Api.instance.jobFeed(offset: more ? _jobs.length : 0);
      if (!more) _jobs.clear();
      final have = _jobs.map((j) => j.key).toSet();
      _jobs.addAll(f.jobs.where((j) => !have.contains(j.key)));
      _total = f.total;
    } on ApiException catch (e) {
      _error = e.message;
    }
    if (mounted) setState(() { _loading = false; _more = false; });
  }

  Future<void> _save(Job j) async {
    try {
      await Api.instance.setJobState(j.key, 'saved');
      setState(() => _saved.add(j.key));
      ref.invalidate(pipelineProvider);
    } on ApiException catch (e) {
      if (mounted) toast(context, e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Loading();
    if (_error != null) return Padding(padding: const EdgeInsets.all(16), child: ErrorBanner(_error!, onRetry: _load));
    final q = _q.text.trim().toLowerCase();
    final list = _jobs.where((j) =>
        (q.isEmpty || j.title.toLowerCase().contains(q) || j.company.toLowerCase().contains(q) || j.location.toLowerCase().contains(q)) &&
        (!_remote || j.workMode == 'remote') && (!_fullTime || (j.jobType ?? '').toLowerCase().contains('full')) && (!_strong || (j.match?.score ?? 0) >= 75)).toList();
    return Column(children: [
      Padding(padding: const EdgeInsets.symmetric(horizontal: Tokens.gutter), child: TextField(controller: _q, onChanged: (_) => setState(() {}), decoration: const InputDecoration(hintText: 'Search jobs…', prefixIcon: Icon(Icons.search)))),
      SizedBox(
        height: 48,
        child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: Tokens.gutter, vertical: 6), children: [
          for (final f in [('Remote', _remote, (bool v) => _remote = v), ('Full-time', _fullTime, (bool v) => _fullTime = v), ('Strong match', _strong, (bool v) => _strong = v)])
            Padding(padding: const EdgeInsets.only(right: 8), child: FilterChip(label: Text(f.$1), selected: f.$2, showCheckmark: false, selectedColor: Tokens.brand, labelStyle: TextStyle(color: f.$2 ? Colors.white : Tokens.textPrimary, fontWeight: FontWeight.w600), onSelected: (v) => setState(() => f.$3(v)))),
        ]),
      ),
      Expanded(
        child: list.isEmpty
            ? EmptyState(icon: Icons.search_off, title: 'No jobs match', body: 'Try different filters, or change your job preferences.', action: OutlineButton(label: 'Change preferences', onPressed: () => context.push('/jobs/preferences').then((_) => _load())))
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView.separated(
                  padding: const EdgeInsets.all(Tokens.gutter), itemCount: list.length + (_jobs.length < _total ? 1 : 0), separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    if (i == list.length) return Center(child: TextButton(onPressed: _more ? null : () => _load(more: true), child: Text(_more ? 'Loading…' : 'Load more')));
                    final j = list[i];
                    return Card(
                      child: ListTile(
                        onTap: () => showJobDetails(context, j),
                        leading: CompanyLogo(j.logo, j.company, size: 42),
                        title: Text(j.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, color: Tokens.navy)),
                        subtitle: Text('${j.company}\n${j.location} · ${ago(j.postedAt)}'),
                        isThreeLine: true,
                        trailing: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                          if (j.match != null) Text('${j.match!.score}', style: TextStyle(fontWeight: FontWeight.w800, color: labelColor(j.match!.label))),
                          IconButton(tooltip: _saved.contains(j.key) ? 'Saved' : 'Save job', visualDensity: VisualDensity.compact, icon: Icon(_saved.contains(j.key) ? Icons.bookmark : Icons.bookmark_border, color: Tokens.brand), onPressed: _saved.contains(j.key) ? null : () => _save(j)),
                        ]),
                      ),
                    );
                  },
                ),
              ),
      ),
    ]);
  }
}
