import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api.dart';
import '../../core/data.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

const _names = {'FREE': 'Free', 'STANDARD': 'Standard', 'PROFESSIONAL': 'Professional', 'PREMIUM': 'Premium'};

String money(num minor, String cur) => '${(minor / 100).toStringAsFixed(minor % 100 == 0 ? 0 : 2)} $cur';

/// Plans + secure checkout. Prices come from the server; the server decides the amount, opens a hosted Moyasar page
/// (card data never touches this app) and activates the plan only after re-checking the payment with Moyasar.
class PlansScreen extends ConsumerStatefulWidget {
  const PlansScreen({super.key});
  @override
  ConsumerState<PlansScreen> createState() => _PlansScreenState();
}

class _PlansScreenState extends ConsumerState<PlansScreen> with WidgetsBindingObserver {
  String _period = 'monthly';
  String? _busy;
  bool _waiting = false, _checking = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _waiting) _confirm();
  }

  Future<void> _pay(String plan) async {
    setState(() { _busy = plan; _error = null; });
    try {
      final r = await Api.instance.post('/billing/checkout', {'plan': plan, 'period': _period});
      final url = (r['value'] as Map)['url'] as String;
      final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      if (!ok) throw ApiException('Could not open the payment page.');
      _waiting = true;
    } on ApiException catch (e) {
      _error = e.message;
    }
    if (mounted) setState(() => _busy = null);
  }

  Future<void> _confirm() async {
    if (_checking) return;
    setState(() { _checking = true; _error = null; });
    try {
      final r = await Api.instance.post('/billing/confirm', {});
      final status = r['status'] as String?;
      if (status == 'paid') {
        _waiting = false;
        ref.invalidate(planProvider);
        if (mounted) toast(context, 'Payment received — your plan is active.');
      } else if (status == 'failed') {
        _waiting = false;
        if (mounted) toast(context, 'The payment was not completed. No money was taken.');
      } else if (mounted) {
        toast(context, 'Still waiting for the payment to be confirmed.');
      }
    } on ApiException catch (e) {
      _error = e.message;
    }
    if (mounted) setState(() => _checking = false);
  }

  String _n(Object? v) => v == null ? 'Unlimited' : '$v';

  @override
  Widget build(BuildContext context) {
    final plan = ref.watch(planProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Plans')),
      body: plan.when(
        loading: () => const Loading(),
        error: (_, __) => Padding(padding: const EdgeInsets.all(16), child: ErrorBanner('Could not load your plan.', onRetry: () => ref.invalidate(planProvider))),
        data: (p) {
          final current = p['plan'] as String;
          final limits = (p['limits'] as Map).cast<String, dynamic>();
          final prices = {for (final x in (p['prices'] as List? ?? const [])) (x as Map)['id'] as String: x.cast<String, dynamic>()};
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(planProvider),
            child: ListView(padding: const EdgeInsets.all(Tokens.gutter), children: [
              Card(child: ListTile(leading: const Icon(Icons.workspace_premium, color: Tokens.brand), title: Text('Your plan: ${_names[current] ?? current}', style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text('Resumes ${p['canCreateResume'] == true ? 'available' : 'limit reached'} · AI ${p['canUseAi'] == true ? 'available' : 'limit reached'} · PDF ${p['canExportPdf'] == true ? 'available' : 'limit reached'}'))),
              const SizedBox(height: 12),
              SegmentedButton<String>(
                showSelectedIcon: false,
                segments: const [ButtonSegment(value: 'monthly', label: Text('Monthly')), ButtonSegment(value: 'yearly', label: Text('Yearly'))],
                selected: {_period}, onSelectionChanged: (s) => setState(() => _period = s.first)),
              const SizedBox(height: 12),
              if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: ErrorBanner(_error!)),
              if (_waiting)
                Card(
                  color: Tokens.subtle,
                  child: ListTile(
                    leading: const Icon(Icons.hourglass_top, color: Tokens.brand), title: const Text('Finished paying?'), subtitle: const Text('Return here and we confirm it with Moyasar.'),
                    trailing: TextButton(onPressed: _checking ? null : _confirm, child: Text(_checking ? 'Checking…' : 'Check payment'))),
                ),
              for (final id in const ['FREE', 'STANDARD', 'PROFESSIONAL', 'PREMIUM'])
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Card(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Tokens.rCard), side: BorderSide(color: id == current ? Tokens.brand : Tokens.border, width: id == current ? 2 : 1)),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [Expanded(child: Text(_names[id]!, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18))), if (id == current) const Chip(label: Text('Current'))]),
                        if (prices[id] != null && id != 'FREE')
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Text('${money((prices[id]![_period == 'monthly' ? 'monthly' : 'yearly'] as num), prices[id]!['currency'] as String)} / ${_period == 'monthly' ? 'month' : 'year'}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Tokens.navy)),
                          ),
                        const SizedBox(height: 4),
                        _line('Resumes', _n((limits[id] as Map)['resumes'])),
                        _line('AI requests / month', _n((limits[id] as Map)['ai_requests_month'])),
                        _line('Downloads / month', _n((limits[id] as Map)['exports_month'])),
                        _line('Editable Word (DOCX)', (limits[id] as Map)['docx'] == true ? 'Included' : '—'),
                        _line('Premium templates', (limits[id] as Map)['premium_templates'] == true ? 'Included' : '—'),
                        _line('Interview Prep', (limits[id] as Map)['interview_prep'] == true ? 'Included' : '—'),
                        if (id != 'FREE' && prices[id] != null) ...[
                          const SizedBox(height: 10),
                          GradientButton(label: id == current ? 'Your plan' : 'Pay ${money((prices[id]![_period] as num), prices[id]!['currency'] as String)}', busy: _busy == id, onPressed: id == current || _busy != null ? null : () => _pay(id)),
                        ],
                      ]),
                    ),
                  ),
                ),
              const Card(child: Padding(padding: EdgeInsets.all(14), child: Text('Payments are processed securely by Moyasar (cards, mada, Apple Pay). Each payment covers one period — pay again to renew. Limits are enforced by our servers.', style: TextStyle(color: Tokens.textSecondary)))),
            ]),
          );
        },
      ),
    );
  }

  Widget _line(String k, String v) => Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Row(children: [Expanded(child: Text(k, style: const TextStyle(color: Tokens.textSecondary))), Text(v, style: const TextStyle(fontWeight: FontWeight.w600))]));
}
