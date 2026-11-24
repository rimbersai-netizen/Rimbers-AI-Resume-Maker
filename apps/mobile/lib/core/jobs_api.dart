import 'api.dart';

class SkillHit {
  final String skill, label;
  final bool required;
  SkillHit(this.skill, this.label, this.required);
  factory SkillHit.fromJson(Map<String, dynamic> j) => SkillHit(j['skill'] as String, j['label'] as String, j['required'] == true);
}

List<SkillHit> _hits(Object? v) => ((v as List?) ?? const []).map((e) => SkillHit.fromJson(Map<String, dynamic>.from(e as Map))).toList();

class JobMatch {
  final int score;
  final String label; // strong | good | stretch
  final List<SkillHit> matched, missing;
  final int? requiredYears;
  final double profileYears;
  JobMatch(this.score, this.label, this.matched, this.missing, this.requiredYears, this.profileYears);
  factory JobMatch.fromJson(Map<String, dynamic> j) => JobMatch(
      (j['score'] as num).toInt(), j['label'] as String, _hits(j['matched']), _hits(j['missing']), (j['requiredYears'] as num?)?.toInt(), (j['profileYears'] as num?)?.toDouble() ?? 0);
  String get labelText => const {'strong': 'Strong match', 'good': 'Good match', 'stretch': 'Stretch match'}[label] ?? 'Match';
}

class Job {
  final String key, source, title, company, location, url, description;
  final String? logo, salaryText, jobType;
  final String workMode;
  final DateTime postedAt;
  final JobMatch? match;
  Job(this.key, this.source, this.title, this.company, this.location, this.url, this.description, this.logo, this.salaryText, this.jobType, this.postedAt, this.match, [this.workMode = 'unknown']);
  factory Job.fromJson(Map<String, dynamic> j) => Job(
      j['key'] as String, j['source'] as String, j['title'] as String, j['company'] as String, (j['location'] as String?) ?? '', j['url'] as String,
      (j['description'] as String?) ?? '', j['logo'] as String?, j['salaryText'] as String?, j['jobType'] as String?, DateTime.parse(j['postedAt'] as String),
      j['match'] == null ? null : JobMatch.fromJson(Map<String, dynamic>.from(j['match'] as Map)), (j['workMode'] as String?) ?? 'unknown');
  String get sourceName => source == 'remotive' ? 'Remotive' : 'Arbeitnow';
}

class JobFeed {
  final List<Job> jobs;
  final int total;
  final bool prefsSaved, profileReady;
  JobFeed(this.jobs, this.total, this.prefsSaved, this.profileReady);
}

class PipelineItem {
  final String id, key, state, title, company;
  final String? url, logo, location, tailoredResumeId;
  final int? matchScore;
  final DateTime updatedAt;
  final DateTime? appliedAt;
  PipelineItem(this.id, this.key, this.state, this.title, this.company, this.url, this.logo, this.location, this.tailoredResumeId, this.matchScore, this.updatedAt, this.appliedAt);
  factory PipelineItem.fromJson(Map<String, dynamic> j) => PipelineItem(
      j['id'] as String, j['key'] as String, j['state'] as String, j['title'] as String, j['company'] as String, j['url'] as String?, j['logo'] as String?, j['location'] as String?,
      j['tailoredResumeId'] as String?, (j['matchScore'] as num?)?.toInt(), DateTime.parse(j['updatedAt'] as String), j['appliedAt'] == null ? null : DateTime.parse(j['appliedAt'] as String));
}

class JobPrefs {
  List<String> roles, workModes;
  int? minSalary, postedWithinDays;
  JobPrefs({this.roles = const [], this.workModes = const [], this.minSalary, this.postedWithinDays});
  factory JobPrefs.fromJson(Map<String, dynamic> j) => JobPrefs(
      roles: List<String>.from(j['roles'] as List? ?? const []), workModes: List<String>.from(j['workModes'] as List? ?? const []),
      minSalary: (j['minSalary'] as num?)?.toInt(), postedWithinDays: (j['postedWithinDays'] as num?)?.toInt());
  Map<String, dynamic> toJson() => {'roles': roles, 'workModes': workModes, 'countries': <String>[], 'minSalary': minSalary, 'postedWithinDays': postedWithinDays};
}

class RoleOption {
  final String id, label, hint;
  RoleOption(this.id, this.label, this.hint);
}

class TailorPlan {
  final Job job;
  final JobMatch match;
  final List<SkillHit> strengths, optimizations, gaps;
  TailorPlan(this.job, this.match, this.strengths, this.optimizations, this.gaps);
}

class Post {
  final String id, handle, kind, title, body;
  final DateTime createdAt;
  int likes, comments;
  bool liked;
  final bool mine;
  Post(this.id, this.handle, this.kind, this.title, this.body, this.createdAt, this.likes, this.comments, this.liked, this.mine);
  factory Post.fromJson(Map<String, dynamic> j) => Post(j['id'] as String, j['handle'] as String, j['kind'] as String, j['title'] as String, j['body'] as String,
      DateTime.parse(j['createdAt'] as String), (j['likes'] as num).toInt(), (j['comments'] as num).toInt(), j['liked'] == true, j['mine'] == true);
}

class Comment {
  final String id, handle, body;
  final DateTime createdAt;
  final bool mine;
  Comment(this.id, this.handle, this.body, this.createdAt, this.mine);
  factory Comment.fromJson(Map<String, dynamic> j) => Comment(j['id'] as String, j['handle'] as String, j['body'] as String, DateTime.parse(j['createdAt'] as String), j['mine'] == true);
}

/// Jobs + community endpoints of the backend `/api/v1`. Failures surface as [ApiException] with a user-readable message.
extension JobsApi on Api {
  Future<JobFeed> jobFeed({int offset = 0}) async {
    final r = await get('/jobs', {'offset': '$offset', 'limit': '20'});
    return JobFeed((r['jobs'] as List).map((e) => Job.fromJson(Map<String, dynamic>.from(e as Map))).toList(), (r['total'] as num).toInt(), r['prefsSaved'] == true, r['profileReady'] == true);
  }

  Future<({JobPrefs prefs, bool saved, List<RoleOption> roles})> jobPrefs() async {
    final r = await get('/jobs/prefs');
    return (
      prefs: JobPrefs.fromJson(Map<String, dynamic>.from(r['prefs'] as Map)),
      saved: r['saved'] == true,
      roles: (r['roles'] as List).map((e) => RoleOption(e['id'] as String, e['label'] as String, e['hint'] as String)).toList(),
    );
  }

  Future<void> saveJobPrefs(JobPrefs p) => put('/jobs/prefs', p.toJson());

  Future<PipelineItem> setJobState(String key, String state) async {
    final r = await post('/jobs/pipeline', {'key': key, 'state': state});
    return PipelineItem.fromJson(Map<String, dynamic>.from((r['value'] as Map)['item'] as Map));
  }

  Future<({List<PipelineItem> items, Map<String, int> counts})> pipeline(List<String> states) async {
    final r = await get('/jobs/pipeline', {'states': states.join(',')});
    return (
      items: (r['items'] as List).map((e) => PipelineItem.fromJson(Map<String, dynamic>.from(e as Map))).toList(),
      counts: (r['counts'] as Map).map((k, v) => MapEntry('$k', (v as num).toInt())),
    );
  }

  Future<void> removePipeline(String id) => delete('/jobs/pipeline/$id');

  Future<TailorPlan> tailorPlan(String key) async {
    final v = Map<String, dynamic>.from((await post('/jobs/tailor', {'key': key}))['value'] as Map);
    final plan = Map<String, dynamic>.from(v['plan'] as Map);
    final job = Job.fromJson({...Map<String, dynamic>.from(v['job'] as Map), 'match': v['match']});
    return TailorPlan(job, JobMatch.fromJson(Map<String, dynamic>.from(v['match'] as Map)), _hits(plan['strengths']), _hits(plan['optimizations']), _hits(plan['gaps']));
  }

  Future<({String resumeId, String? aiJobId, List<String> added, String? aiMessage})> applyTailor(String key, List<String> skills, bool summary) async {
    final v = Map<String, dynamic>.from((await post('/jobs/tailor/apply', {'key': key, 'addSkills': skills, 'tailorSummary': summary}))['value'] as Map);
    return (resumeId: v['resumeId'] as String, aiJobId: v['aiJobId'] as String?, added: List<String>.from(v['added'] as List? ?? const []), aiMessage: v['aiMessage'] as String?);
  }

  Future<String> finishTailor(String resumeId, String aiJobId) async {
    final v = Map<String, dynamic>.from((await post('/jobs/tailor/finish', {'resumeId': resumeId, 'aiJobId': aiJobId}))['value'] as Map);
    return v['summary'] as String;
  }

  // ---- community
  Future<List<Post>> posts({String? kind}) async {
    final r = await get('/community/posts', {if (kind != null) 'kind': kind});
    return (r['posts'] as List).map((e) => Post.fromJson(Map<String, dynamic>.from(e as Map))).toList();
  }

  Future<({Post post, List<Comment> comments})> postThread(String id) async {
    final r = await get('/community/posts/$id');
    return (post: Post.fromJson(Map<String, dynamic>.from(r['post'] as Map)), comments: (r['comments'] as List).map((e) => Comment.fromJson(Map<String, dynamic>.from(e as Map))).toList());
  }

  Future<void> createPost(String kind, String title, String body) => post('/community/posts', {'kind': kind, 'title': title, 'body': body});
  Future<void> deletePost(String id) => delete('/community/posts/$id');
  Future<Comment> addComment(String postId, String body) async {
    final r = await post('/community/posts/$postId/comments', {'body': body});
    return Comment.fromJson(Map<String, dynamic>.from((r['value'] as Map)['comment'] as Map));
  }

  Future<void> deleteComment(String id) => delete('/community/comments/$id');
  Future<void> toggleLike(String postId) => post('/community/posts/$postId/like', {});
  Future<void> reportContent({String? postId, String? commentId, required String reason}) =>
      post('/community/report', {if (postId != null) 'postId': postId, if (commentId != null) 'commentId': commentId, 'reason': reason});
}
