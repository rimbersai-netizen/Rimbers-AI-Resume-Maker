import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/config.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  Widget _row(BuildContext context, IconData icon, String title, {String? subtitle, VoidCallback? onTap, Color? color}) => ListTile(
        leading: Icon(icon, color: color ?? Tokens.textSecondary), title: Text(title, style: TextStyle(color: color)), subtitle: subtitle == null ? null : Text(subtitle),
        trailing: onTap == null ? null : const Icon(Icons.chevron_right), onTap: onTap);

  @override
  Widget build(BuildContext context) {
    final user = Supabase.instance.client.auth.currentUser;
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(padding: const EdgeInsets.all(Tokens.gutter), children: [
        Card(child: ListTile(leading: const CircleAvatar(backgroundColor: Tokens.subtle, child: Icon(Icons.person, color: Tokens.brand)), title: Text(user?.email ?? '', style: const TextStyle(fontWeight: FontWeight.w600)), subtitle: const Text('Signed in'))),
        const SizedBox(height: 12),
        Card(
          child: Column(children: [
            _row(context, Icons.lock_outline, 'Change password', onTap: () => _changePassword(context)),
            const Divider(height: 1),
            _row(context, Icons.workspace_premium_outlined, 'Plan & usage', onTap: () => context.push('/plans')),
            const Divider(height: 1),
            _row(context, Icons.language, 'Language', subtitle: 'App language follows your device. Resume and letter languages are chosen per document.'),
            const Divider(height: 1),
            _row(context, Icons.shield_outlined, 'Privacy & data', subtitle: 'Download your data or manage your account on the website', onTap: () => launchUrl(Uri.parse('${Config.apiBase}/account'), mode: LaunchMode.externalApplication)),
            const Divider(height: 1),
            _row(context, Icons.delete_forever_outlined, 'Request account deletion', color: Tokens.danger, onTap: () => _requestDeletion(context)),
          ]),
        ),
        const SizedBox(height: 12),
        Card(child: _row(context, Icons.logout, 'Sign Out', color: Tokens.danger, onTap: () async {
          if (await confirm(context, title: 'Sign out?', body: 'You will need to sign in again.', action: 'Sign out')) {
            await Supabase.instance.client.auth.signOut();
          }
        })),
        const Padding(padding: EdgeInsets.all(16), child: Text('Rimbers AI Resume Maker · v1.0.0', textAlign: TextAlign.center, style: TextStyle(color: Tokens.textSecondary, fontSize: 12))),
      ]),
    );
  }

  Future<void> _changePassword(BuildContext context) async {
    final c = TextEditingController();
    final v = await showDialog<String>(
      context: context,
      builder: (d) => AlertDialog(
        title: const Text('New password'),
        content: TextField(controller: c, obscureText: true, decoration: const InputDecoration(hintText: 'At least 8 characters')),
        actions: [TextButton(onPressed: () => Navigator.pop(d), child: const Text('Cancel')), TextButton(onPressed: () => Navigator.pop(d, c.text), child: const Text('Update'))],
      ),
    );
    if (v == null) return;
    if (v.length < 8) { if (context.mounted) toast(context, 'Use at least 8 characters.'); return; }
    try {
      await Supabase.instance.client.auth.updateUser(UserAttributes(password: v));
      if (context.mounted) toast(context, 'Password updated');
    } catch (_) {
      if (context.mounted) toast(context, 'Could not update the password. Sign in again and retry.');
    }
  }

  Future<void> _requestDeletion(BuildContext context) async {
    if (!await confirm(context, title: 'Request account deletion?', body: 'Your account and all data will be permanently deleted after processing. This cannot be undone.', action: 'Request deletion')) return;
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return;
    try {
      await Supabase.instance.client.from('deletion_requests').insert({'user_id': user.id, 'reason': 'Requested from the mobile app'});
      if (context.mounted) toast(context, 'Deletion requested. We will confirm by email.');
    } on PostgrestException catch (e) {
      if (context.mounted) toast(context, e.code == '23505' ? 'A deletion request is already being processed.' : 'Could not submit the request.');
    } catch (_) {
      if (context.mounted) toast(context, 'Could not submit the request.');
    }
  }
}
