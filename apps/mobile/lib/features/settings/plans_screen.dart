import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/data.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

const _names = {'FREE': 'Free', 'STANDARD': 'Standard', 'PROFESSIONAL': 'Professional', 'PREMIUM': 'Premium'};

/// Shows the real limits the server enforces. Purchasing is not enabled yet (payment provider pending) — we say so plainly.
class PlansScreen extends ConsumerWidget {
  const PlansScreen({super.key});

  String _n(Object? v) => v == null ? 'Unlimited' : '$v';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final plan = ref.watch(planProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Plans')),
      body: plan.when(
        loading: () => const Loading(),
        error: (_, __) => Padding(padding: const EdgeInsets.all(16), child: ErrorBanner('Could not load your plan.', onRetry: () => ref.invalidate(planProvider))),
        data: (p) {
          final current = p['plan'] as String;
          final limits = (p['limits'] as Map).cast<String, dynamic>();
          return ListView(padding: const EdgeInsets.all(Tokens.gutter), children: [
            Card(child: ListTile(leading: const Icon(Icons.workspace_premium, color: Tokens.brand), title: Text('Your plan: ${_names[current] ?? current}', style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text('Resumes ${p['canCreateResume'] == true ? 'available' : 'limit reached'} · AI ${p['canUseAi'] == true ? 'available' : 'limit reached'} · PDF ${p['canExportPdf'] == true ? 'available' : 'limit reached'}'))),
            const SizedBox(height: 12),
            for (final id in const ['FREE', 'STANDARD', 'PROFESSIONAL', 'PREMIUM'])
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Card(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Tokens.rCard), side: BorderSide(color: id == current ? Tokens.brand : Tokens.border, width: id == current ? 2 : 1)),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [Expanded(child: Text(_names[id]!, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18))), if (id == current) const Chip(label: Text('Current'))]),
                      const SizedBox(height: 8),
                      _line('Resumes', _n((limits[id] as Map)['resumes'])),
                      _line('AI requests / month', _n((limits[id] as Map)['ai_requests_month'])),
                      _line('Downloads / month', _n((limits[id] as Map)['exports_month'])),
                      _line('Editable Word (DOCX)', (limits[id] as Map)['docx'] == true ? 'Included' : '—'),
                      _line('Premium templates', (limits[id] as Map)['premium_templates'] == true ? 'Included' : '—'),
                    ]),
                  ),
                ),
              ),
            const Card(child: Padding(padding: EdgeInsets.all(14), child: Text('Upgrades are not available in the app yet — secure payments are still being set up. Limits above are enforced by our servers.', style: TextStyle(color: Tokens.textSecondary)))),
          ]);
        },
      ),
    );
  }

  Widget _line(String k, String v) => Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Row(children: [Expanded(child: Text(k, style: const TextStyle(color: Tokens.textSecondary))), Text(v, style: const TextStyle(fontWeight: FontWeight.w600))]));
}
