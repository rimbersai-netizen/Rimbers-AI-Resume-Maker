import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/brand.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';
import 'auth_screens.dart' show validateEmail, friendlyAuthError;

const otpLength = 6;

/// 6-digit code entry for sign-up confirmation (`signup`) and passwordless sign-in (`email`).
/// On success Supabase creates the session and the router's auth listener moves the user into the app.
class OtpScreen extends StatefulWidget {
  final String email;
  final String type; // 'signup' | 'email'
  const OtpScreen({super.key, required this.email, required this.type});
  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final _code = TextEditingController();
  final _focus = FocusNode();
  Timer? _timer;
  int _wait = 60;
  bool _busy = false, _resending = false;
  String? _error, _info;

  bool get _signup => widget.type == 'signup';

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _startTimer() {
    _timer?.cancel();
    setState(() => _wait = 60);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted || _wait <= 1) { t.cancel(); if (mounted) setState(() => _wait = 0); return; }
      setState(() => _wait--);
    });
  }

  Future<void> _verify() async {
    final token = _code.text.trim();
    if (token.length != otpLength) return setState(() => _error = 'Enter the $otpLength-digit code.');
    setState(() { _busy = true; _error = null; _info = null; });
    try {
      await Supabase.instance.client.auth.verifyOTP(email: widget.email, token: token, type: _signup ? OtpType.signup : OtpType.email);
      // The auth listener in the router redirects to /home once the session exists.
    } on AuthException catch (e) {
      if (mounted) setState(() { _error = e.statusCode == '429' ? 'Too many attempts. Please wait a minute and try again.' : 'That code is incorrect or has expired. Check it or request a new one.'; _code.clear(); });
    } catch (e) {
      if (mounted) setState(() => _error = friendlyAuthError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    setState(() { _resending = true; _error = null; _info = null; });
    try {
      final auth = Supabase.instance.client.auth;
      if (_signup) {
        await auth.resend(type: OtpType.signup, email: widget.email);
      } else {
        await auth.signInWithOtp(email: widget.email, shouldCreateUser: false);
      }
      if (mounted) { setState(() => _info = 'If that email can receive a code, a new one is on its way.'); _startTimer(); }
    } on AuthException catch (e) {
      if (mounted) setState(() => _error = e.statusCode == '429' ? 'Please wait a minute before requesting another code.' : 'Could not send a new code. Try again shortly.');
    } catch (e) {
      if (mounted) setState(() => _error = friendlyAuthError(e));
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final digits = _code.text;
    return Scaffold(
      appBar: AppBar(leading: BackButton(onPressed: () => context.canPop() ? context.pop() : context.go(_signup ? '/sign-up' : '/sign-in'))),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(Tokens.gutter * 1.5),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                const Center(child: RimbersLogo(size: 44)),
                const SizedBox(height: 24),
                Text('Enter your code', textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800, color: Tokens.navy)),
                const SizedBox(height: 8),
                Text('We sent a $otpLength-digit code to\n${widget.email}', textAlign: TextAlign.center, style: const TextStyle(color: Tokens.textSecondary, height: 1.4)),
                const SizedBox(height: 24),
                // Visual boxes mirror a single hidden field, so paste, autofill and the keyboard all work.
                Semantics(
                  label: 'One-time code, $otpLength digits',
                  textField: true,
                  child: GestureDetector(
                    onTap: () => _focus.requestFocus(),
                    child: Stack(alignment: Alignment.center, children: [
                      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                        for (var i = 0; i < otpLength; i++)
                          Container(
                            width: 46, height: 56, alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: Tokens.surface, borderRadius: BorderRadius.circular(Tokens.rInput),
                              border: Border.all(color: i == digits.length && _focus.hasFocus ? Tokens.brand : Tokens.border, width: i == digits.length ? 2 : 1)),
                            child: Text(i < digits.length ? digits[i] : '', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Tokens.navy)),
                          ),
                      ]),
                      Positioned.fill(
                        child: Opacity(
                          opacity: 0.01,
                          child: TextField(
                            controller: _code, focusNode: _focus, autofocus: true, keyboardType: TextInputType.number, maxLength: otpLength,
                            autofillHints: const [AutofillHints.oneTimeCode], inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                            decoration: const InputDecoration(counterText: '', border: InputBorder.none),
                            onChanged: (v) { setState(() => _error = null); if (v.length == otpLength) _verify(); },
                          ),
                        ),
                      ),
                    ]),
                  ),
                ),
                const SizedBox(height: 20),
                if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: ErrorBanner(_error!)),
                if (_info != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_info!, textAlign: TextAlign.center, style: const TextStyle(color: Tokens.success))),
                GradientButton(label: _signup ? 'Confirm and continue' : 'Sign in', busy: _busy, onPressed: digits.length == otpLength ? _verify : null),
                const SizedBox(height: 8),
                TextButton(onPressed: _wait > 0 || _resending ? null : _resend, child: Text(_wait > 0 ? 'Send a new code in ${_wait}s' : (_resending ? 'Sending…' : 'Send a new code'))),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

/// Passwordless login step 1: ask for an email, send the code, continue to [OtpScreen].
class EmailCodeScreen extends StatefulWidget {
  const EmailCodeScreen({super.key});
  @override
  State<EmailCodeScreen> createState() => _EmailCodeScreenState();
}

class _EmailCodeScreenState extends State<EmailCodeScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (!_form.currentState!.validate()) return;
    final email = _email.text.trim();
    setState(() { _busy = true; _error = null; });
    try {
      await Supabase.instance.client.auth.signInWithOtp(email: email, shouldCreateUser: false);
    } on AuthException catch (e) {
      // Only rate limits are reported: anything else would reveal whether the account exists.
      if (e.statusCode == '429') {
        if (mounted) setState(() { _error = 'Too many attempts. Please wait a minute and try again.'; _busy = false; });
        return;
      }
    } catch (e) {
      if (mounted) setState(() { _error = friendlyAuthError(e); _busy = false; });
      return;
    }
    if (mounted) {
      setState(() => _busy = false);
      context.push('/verify?type=email&email=${Uri.encodeQueryComponent(email)}');
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(),
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(Tokens.gutter * 1.5),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Form(
                  key: _form,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    const Center(child: RimbersLogo(size: 44)),
                    const SizedBox(height: 24),
                    Text('Sign in with a code', textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800, color: Tokens.navy)),
                    const SizedBox(height: 8),
                    const Text('We’ll email you a 6-digit code. No password needed.', textAlign: TextAlign.center, style: TextStyle(color: Tokens.textSecondary)),
                    const SizedBox(height: 24),
                    TextFormField(
                      controller: _email, keyboardType: TextInputType.emailAddress, autofillHints: const [AutofillHints.email], onFieldSubmitted: (_) => _send(),
                      decoration: const InputDecoration(labelText: 'Email address', prefixIcon: Icon(Icons.mail_outline)), validator: validateEmail),
                    const SizedBox(height: 16),
                    if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: ErrorBanner(_error!)),
                    GradientButton(label: 'Email me a code', busy: _busy, onPressed: _send),
                    TextButton(onPressed: () => context.pop(), child: const Text('Use my password instead')),
                  ]),
                ),
              ),
            ),
          ),
        ),
      );
}
