import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

typedef PickedFile = ({String name, List<int> bytes});

/// "Import your existing resume": upload a PDF/Word file → AI reads it → the profile is filled in → the user only picks a
/// new template. Everything the AI returns is checked against the file's own text on the server (nothing is invented).
class ImportResumeCard extends StatefulWidget {
  /// Called after the imported data has been saved to the profile.
  final VoidCallback? onImported;
  // Test seams — the app uses the real file picker and backend.
  final Future<PickedFile?> Function()? pick;
  final Future<String> Function(String name, List<int> bytes)? upload;
  final Future<Map<String, dynamic>> Function(String jobId)? poll;
  final Future<bool> Function()? profileHasData;
  final Future<void> Function(String jobId)? apply;
  final Duration pollEvery;
  const ImportResumeCard({super.key, this.onImported, this.pick, this.upload, this.poll, this.profileHasData, this.apply, this.pollEvery = const Duration(seconds: 2)});

  @override
  State<ImportResumeCard> createState() => _ImportResumeCardState();
}

enum _Phase { idle, working, ready, done }

class _ImportResumeCardState extends State<ImportResumeCard> {
  _Phase _phase = _Phase.idle;
  String _step = 'Reading your file…';
  String? _error, _jobId, _fileName;
  bool _upgrade = false, _saving = false;
  Map<String, dynamic>? _result; // imported_profile output
  bool _disposed = false;

  @override
  void dispose() { _disposed = true; super.dispose(); }

  Future<PickedFile?> _pick() async {
    if (widget.pick != null) return widget.pick!();
    final f = await FilePicker.pickFile(type: FileType.custom, allowedExtensions: const ['pdf', 'docx', 'txt']);
    if (f == null) return null;
    return (name: f.name, bytes: await f.xFile.readAsBytes());
  }

  Future<void> _start() async {
    setState(() { _error = null; _upgrade = false; });
    final PickedFile? file;
    try {
      file = await _pick();
    } catch (_) {
      return setState(() => _error = 'Could not open that file. Please try another one.');
    }
    if (file == null || _disposed) return;
    if (file.bytes.length > 5 * 1024 * 1024) return setState(() => _error = 'That file is too large (max 5 MB).');
    setState(() { _phase = _Phase.working; _fileName = file!.name; _step = 'Uploading your resume…'; });
    try {
      final id = await (widget.upload ?? Api.instance.importResume)(file.name, file.bytes);
      _jobId = id;
      if (!_disposed) setState(() => _step = 'Reading your experience, education and skills…');
      for (var i = 0; i < 60; i++) {
        await Future<void>.delayed(widget.pollEvery);
        if (_disposed) return;
        final s = await (widget.poll ?? Api.instance.aiJob)(id);
        final status = s['status'];
        if (status == 'succeeded') {
          final out = s['output'] as Map<String, dynamic>;
          return setState(() { _result = out; _phase = _Phase.ready; });
        }
        if (status == 'failed' || status == 'cancelled') {
          return setState(() { _phase = _Phase.idle; _error = (s['message'] as String?) ?? 'We could not read that file. Please try again.'; });
        }
      }
      setState(() { _phase = _Phase.idle; _error = 'This is taking longer than expected. Please try again in a moment.'; });
    } on ApiException catch (e) {
      if (!_disposed) setState(() { _phase = _Phase.idle; _error = e.message; _upgrade = e.upgrade; });
    } catch (_) {
      if (!_disposed) setState(() { _phase = _Phase.idle; _error = 'Something went wrong. Please try again.'; });
    }
  }

  Future<bool> _confirmReplace() async {
    bool hasData;
    try {
      hasData = await (widget.profileHasData ?? _profileHasData)();
    } catch (_) {
      hasData = false;
    }
    if (!hasData || !mounted) return true;
    return await showDialog<bool>(
          context: context,
          builder: (c) => AlertDialog(
            title: const Text('Replace your profile details?'),
            content: const Text('You already have details saved. Using this resume replaces them with what was found in the file. Your photo is kept and the previous version stays in your profile history.'),
            actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Replace'))],
          ),
        ) ??
        false;
  }

  static Future<bool> _profileHasData() async {
    final p = (await Api.instance.loadProfile()).data;
    bool any(String k) => p[k] is List && (p[k] as List).isNotEmpty;
    return any('experience') || any('education') || any('skills');
  }

  Future<void> _use() async {
    final id = _jobId;
    if (id == null || _saving) return;
    if (!await _confirmReplace()) return;
    setState(() { _saving = true; _error = null; });
    try {
      await (widget.apply ?? (j) => Api.instance.applyImport(j))(id);
      if (_disposed) return;
      setState(() => _phase = _Phase.done);
      widget.onImported?.call();
    } on ApiException catch (e) {
      if (!_disposed) setState(() => _error = e.issues.isNotEmpty ? 'Some imported values need fixing: ${e.issues.values.first}. You can add them in your profile.' : e.message);
    } catch (_) {
      if (!_disposed) setState(() => _error = 'Could not save the imported details. Please try again.');
    } finally {
      if (!_disposed) setState(() => _saving = false);
    }
  }

  String _summary() {
    final c = (_result?['counts'] as Map?) ?? const {};
    final name = ((_result?['profile'] as Map?)?['personal'] as Map?)?['fullName'] as String?;
    String n(String k, String one, String many) { final v = (c[k] as num?)?.toInt() ?? 0; return v == 0 ? '' : '$v ${v == 1 ? one : many}'; }
    final parts = [n('experience', 'job', 'jobs'), n('education', 'education entry', 'education entries'), n('skills', 'skill', 'skills'), n('languages', 'language', 'languages'), n('certifications', 'certification', 'certifications')].where((s) => s.isNotEmpty).toList();
    return [if (name != null && name.isNotEmpty) name, if (parts.isNotEmpty) parts.join(' · ')].join('\n');
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Tokens.surface, borderRadius: BorderRadius.circular(Tokens.rCard),
        border: Border.all(color: _phase == _Phase.done ? Tokens.brand : Tokens.border, width: _phase == _Phase.done ? 1.5 : 1),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(color: Tokens.subtle, borderRadius: BorderRadius.circular(14)),
            child: Icon(_phase == _Phase.done ? Icons.check_circle : Icons.upload_file, color: Tokens.brand),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(_phase == _Phase.done ? 'Resume imported' : 'Import your existing resume', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 2),
            Text(
              _phase == _Phase.done ? 'Your details are in your profile. Now pick a template below.' : 'Upload a PDF or Word file — we fill in your details so you only choose a new template.',
              style: const TextStyle(color: Tokens.textSecondary, fontSize: 13),
            ),
          ])),
        ]),
        const SizedBox(height: 12),
        if (_phase == _Phase.working) ...[
          const LinearProgressIndicator(minHeight: 4),
          const SizedBox(height: 8),
          Text('${_fileName ?? ''}\n$_step', style: const TextStyle(color: Tokens.textSecondary, fontSize: 13)),
        ] else if (_phase == _Phase.ready) ...[
          Container(
            width: double.infinity, padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Tokens.subtle, borderRadius: BorderRadius.circular(Tokens.rInput)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Found in your resume', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text(_summary(), style: const TextStyle(color: Tokens.textSecondary)),
              if (((_result?['dropped'] as num?) ?? 0) > 0) const Padding(padding: EdgeInsets.only(top: 6), child: Text('Anything not clearly written in your file was left out.', style: TextStyle(color: Tokens.textSecondary, fontSize: 12))),
            ]),
          ),
          const SizedBox(height: 10),
          GradientButton(label: 'Use these details', leading: Icons.check, busy: _saving, onPressed: _use),
          const SizedBox(height: 6),
          Center(child: TextButton(onPressed: _saving ? null : () => setState(() { _phase = _Phase.idle; _result = null; }), child: const Text('Choose a different file'))),
        ] else if (_phase == _Phase.done)
          Align(alignment: Alignment.centerLeft, child: TextButton.icon(onPressed: _start, icon: const Icon(Icons.refresh, size: 18), label: const Text('Import a different file')))
        else
          SizedBox(width: double.infinity, child: OutlinedButton.icon(onPressed: _start, icon: const Icon(Icons.upload_file), label: const Text('Upload PDF or Word file'))),
        if (_error != null) Padding(padding: const EdgeInsets.only(top: 10), child: ErrorBanner(_error!, onUpgrade: _upgrade ? () => context.push('/plans') : null)),
      ]),
    );
  }
}
