import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/brand.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

final _emailRe = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

String? validateEmail(String? v) {
  final t = (v ?? '').trim();
  if (t.isEmpty) return 'Required';
  return _emailRe.hasMatch(t) ? null : 'Enter a valid email address';
}

String? validatePassword(String? v) => (v ?? '').length >= 8 ? null : 'Use at least 8 characters';

String friendlyAuthError(Object e) {
  final m = e is AuthException ? e.message.toLowerCase() : '$e'.toLowerCase();
  if (m.contains('invalid login')) return 'Email or password is incorrect.';
  if (m.contains('email not confirmed')) return 'Confirm your email first — check your inbox.';
  if (m.contains('already registered') || m.contains('already been registered')) return 'An account with this email already exists. Try signing in.';
  if (m.contains('rate limit') || m.contains('too many')) return 'Too many attempts. Please wait a minute and try again.';
  if (m.contains('socket') || m.contains('connection') || m.contains('failed host')) return 'Cannot reach the server. Check your connection.';
  return 'Something went wrong. Please try again.';
}

class _AuthScaffold extends StatelessWidget {
  final String title;
  final String subtitle;
  final List<Widget> children;
  final bool back;
  const _AuthScaffold({required this.title, required this.subtitle, required this.children, this.back = false});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: back ? AppBar() : null,
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(Tokens.gutter * 1.5),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  const Center(child: RimbersLogo(size: 56, stacked: true)),
                  const SizedBox(height: 28),
                  Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text(subtitle, textAlign: TextAlign.center, style: const TextStyle(color: Tokens.textSecondary)),
                  const SizedBox(height: 24),
                  ...children,
                ]),
              ),
            ),
          ),
        ),
      );
}

/// Google sign-in through Supabase OAuth in the system browser; the rimbers://login-callback deep link brings the session back to the app.
class GoogleSignInButton extends StatefulWidget {
  const GoogleSignInButton({super.key});
  @override
  State<GoogleSignInButton> createState() => _GoogleSignInButtonState();
}

class _GoogleSignInButtonState extends State<GoogleSignInButton> {
  bool _busy = false;

  Future<void> _go() async {
    setState(() => _busy = true);
    try {
      await Supabase.instance.client.auth.signInWithOAuth(OAuthProvider.google, redirectTo: 'rimbers://login-callback', authScreenLaunchMode: LaunchMode.externalApplication);
    } catch (e) {
      if (mounted) toast(context, 'Google sign-in is not available right now.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Column(children: [
        const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('or continue with', style: TextStyle(color: Tokens.textSecondary, fontSize: 13))),
        OutlinedButton.icon(
          onPressed: _busy ? null : _go,
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(50), side: const BorderSide(color: Tokens.border), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Tokens.rButton))),
          icon: const Text('G', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: Color(0xFF4285F4))),
          label: Text(_busy ? 'Opening Google…' : 'Continue with Google', style: const TextStyle(color: Tokens.navy, fontWeight: FontWeight.w600)),
        ),
      ]);
}

class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});
  @override
  State<SignInScreen> createState() => _SignInState();
}

class _SignInState extends State<SignInScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false, _hide = true;
  String? _error;

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() { _busy = true; _error = null; });
    try {
      await Supabase.instance.client.auth.signInWithPassword(email: _email.text.trim(), password: _password.text);
    } catch (e) {
      if (mounted) setState(() => _error = friendlyAuthError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => _AuthScaffold(
        title: 'Welcome Back 👋', subtitle: 'Sign in to continue',
        children: [
          Form(
            key: _form,
            child: Column(children: [
              TextFormField(controller: _email, keyboardType: TextInputType.emailAddress, autofillHints: const [AutofillHints.email], textInputAction: TextInputAction.next,
                decoration: const InputDecoration(labelText: 'Email address', prefixIcon: Icon(Icons.mail_outline)), validator: validateEmail),
              const SizedBox(height: 14),
              TextFormField(controller: _password, obscureText: _hide, autofillHints: const [AutofillHints.password], onFieldSubmitted: (_) => _submit(),
                decoration: InputDecoration(labelText: 'Password', prefixIcon: const Icon(Icons.lock_outline),
                  suffixIcon: IconButton(tooltip: _hide ? 'Show password' : 'Hide password', icon: Icon(_hide ? Icons.visibility_off_outlined : Icons.visibility_outlined), onPressed: () => setState(() => _hide = !_hide))),
                validator: (v) => (v ?? '').isEmpty ? 'Required' : null),
            ]),
          ),
          Align(alignment: AlignmentDirectional.centerEnd, child: TextButton(onPressed: () => context.push('/forgot-password'), child: const Text('Forgot password?'))),
          if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: ErrorBanner(_error!)),
          GradientButton(label: 'Sign In', busy: _busy, onPressed: _submit),
          TextButton(onPressed: () => context.push('/sign-in/code'), child: const Text('Email me a sign-in code instead')),
          const GoogleSignInButton(),
          const SizedBox(height: 16),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Text("Don't have an account?", style: TextStyle(color: Tokens.textSecondary)),
            TextButton(onPressed: () => context.go('/sign-up'), child: const Text('Sign Up')),
          ]),
        ],
      );
}

class SignUpScreen extends StatefulWidget {
  const SignUpScreen({super.key});
  @override
  State<SignUpScreen> createState() => _SignUpState();
}

class _SignUpState extends State<SignUpScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false, _sent = false;
  String? _error;

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() { _busy = true; _error = null; });
    try {
      final r = await Supabase.instance.client.auth.signUp(email: _email.text.trim(), password: _password.text);
      // With email confirmation on there is no session yet: continue to the 6-digit code screen.
      if (mounted && r.session == null) context.push('/verify?type=signup&email=${Uri.encodeQueryComponent(_email.text.trim())}');
    } catch (e) {
      if (mounted) setState(() => _error = friendlyAuthError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_sent) {
      return _AuthScaffold(title: 'Check your email', subtitle: 'We sent a confirmation link to ${_email.text.trim()}. Open it, then sign in.', children: [
        GradientButton(label: 'Back to Sign In', onPressed: () => context.go('/sign-in')),
      ]);
    }
    return _AuthScaffold(
      back: true, title: 'Create Your Account', subtitle: 'Your data stays private and is never sold',
      children: [
        Form(
          key: _form,
          child: Column(children: [
            TextFormField(controller: _email, keyboardType: TextInputType.emailAddress, textInputAction: TextInputAction.next,
              decoration: const InputDecoration(labelText: 'Email address', prefixIcon: Icon(Icons.mail_outline)), validator: validateEmail),
            const SizedBox(height: 14),
            TextFormField(controller: _password, obscureText: true, textInputAction: TextInputAction.next,
              decoration: const InputDecoration(labelText: 'Password (8+ characters)', prefixIcon: Icon(Icons.lock_outline)), validator: validatePassword),
            const SizedBox(height: 14),
            TextFormField(controller: _confirm, obscureText: true, onFieldSubmitted: (_) => _submit(),
              decoration: const InputDecoration(labelText: 'Confirm password', prefixIcon: Icon(Icons.lock_outline)),
              validator: (v) => v == _password.text ? null : 'Passwords do not match'),
          ]),
        ),
        const SizedBox(height: 16),
        if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: ErrorBanner(_error!)),
        GradientButton(label: 'Create Account', busy: _busy, onPressed: _submit),
        const GoogleSignInButton(),
        TextButton(onPressed: () => context.go('/sign-in'), child: const Text('I already have an account')),
      ],
    );
  }
}

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});
  @override
  State<ForgotPasswordScreen> createState() => _ForgotState();
}

class _ForgotState extends State<ForgotPasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  bool _busy = false, _sent = false;
  String? _error;

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() { _busy = true; _error = null; });
    try {
      await Supabase.instance.client.auth.resetPasswordForEmail(_email.text.trim());
      if (mounted) setState(() => _sent = true);
    } catch (e) {
      if (mounted) setState(() => _error = friendlyAuthError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => _AuthScaffold(
        back: true, title: 'Reset your password', subtitle: _sent ? 'If that email has an account, a reset link is on its way.' : "Enter your email and we'll send a reset link.",
        children: _sent
            ? [GradientButton(label: 'Back to Sign In', onPressed: () => context.go('/sign-in'))]
            : [
                Form(key: _form, child: TextFormField(controller: _email, keyboardType: TextInputType.emailAddress, onFieldSubmitted: (_) => _submit(),
                  decoration: const InputDecoration(labelText: 'Email address', prefixIcon: Icon(Icons.mail_outline)), validator: validateEmail)),
                const SizedBox(height: 16),
                if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: ErrorBanner(_error!)),
                GradientButton(label: 'Send reset link', busy: _busy, onPressed: _submit),
              ],
      );
}
