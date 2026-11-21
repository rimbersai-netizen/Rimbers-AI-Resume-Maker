/**
 * Section headings in the RESUME language (document content, independent of app UI language).
 * Status: machine-drafted, pending native review (see docs/localization). English is the fallback.
 */
import type { SectionKey } from "@gars/resume-schema";

type Labels = Record<SectionKey | "present" | "contact", string>;

export const RESUME_HEADINGS: Record<string, Labels> = {
  en: { summary: "Professional Summary", experience: "Work Experience", education: "Education", skills: "Skills", certifications: "Certifications", languages: "Languages", projects: "Projects", publications: "Publications", awards: "Awards", volunteer: "Volunteer Experience", references: "References", custom: "Additional Information", present: "Present", contact: "Contact" },
  ar: { summary: "الملخص المهني", experience: "الخبرة العملية", education: "التعليم", skills: "المهارات", certifications: "الشهادات", languages: "اللغات", projects: "المشاريع", publications: "المنشورات", awards: "الجوائز", volunteer: "العمل التطوعي", references: "المراجع", custom: "معلومات إضافية", present: "حتى الآن", contact: "معلومات الاتصال" },
  ur: { summary: "پیشہ ورانہ خلاصہ", experience: "کام کا تجربہ", education: "تعلیم", skills: "مہارتیں", certifications: "سرٹیفیکیشنز", languages: "زبانیں", projects: "منصوبے", publications: "اشاعتیں", awards: "اعزازات", volunteer: "رضاکارانہ تجربہ", references: "حوالہ جات", custom: "اضافی معلومات", present: "تاحال", contact: "رابطہ" },
  fr: { summary: "Profil professionnel", experience: "Expérience professionnelle", education: "Formation", skills: "Compétences", certifications: "Certifications", languages: "Langues", projects: "Projets", publications: "Publications", awards: "Distinctions", volunteer: "Bénévolat", references: "Références", custom: "Informations complémentaires", present: "Aujourd’hui", contact: "Contact" },
  de: { summary: "Profil", experience: "Berufserfahrung", education: "Ausbildung", skills: "Kenntnisse", certifications: "Zertifizierungen", languages: "Sprachen", projects: "Projekte", publications: "Veröffentlichungen", awards: "Auszeichnungen", volunteer: "Ehrenamt", references: "Referenzen", custom: "Weitere Angaben", present: "heute", contact: "Kontakt" },
  es: { summary: "Perfil profesional", experience: "Experiencia laboral", education: "Formación", skills: "Habilidades", certifications: "Certificaciones", languages: "Idiomas", projects: "Proyectos", publications: "Publicaciones", awards: "Premios", volunteer: "Voluntariado", references: "Referencias", custom: "Información adicional", present: "Actualidad", contact: "Contacto" },
  it: { summary: "Profilo professionale", experience: "Esperienza lavorativa", education: "Istruzione", skills: "Competenze", certifications: "Certificazioni", languages: "Lingue", projects: "Progetti", publications: "Pubblicazioni", awards: "Riconoscimenti", volunteer: "Volontariato", references: "Referenze", custom: "Informazioni aggiuntive", present: "Oggi", contact: "Contatti" },
  pt: { summary: "Resumo profissional", experience: "Experiência profissional", education: "Formação acadêmica", skills: "Competências", certifications: "Certificações", languages: "Idiomas", projects: "Projetos", publications: "Publicações", awards: "Prêmios", volunteer: "Voluntariado", references: "Referências", custom: "Informações adicionais", present: "Atual", contact: "Contato" },
  hi: { summary: "पेशेवर सारांश", experience: "कार्य अनुभव", education: "शिक्षा", skills: "कौशल", certifications: "प्रमाणपत्र", languages: "भाषाएँ", projects: "परियोजनाएँ", publications: "प्रकाशन", awards: "पुरस्कार", volunteer: "स्वयंसेवी अनुभव", references: "संदर्भ", custom: "अतिरिक्त जानकारी", present: "वर्तमान", contact: "संपर्क" },
  tr: { summary: "Profesyonel Özet", experience: "İş Deneyimi", education: "Eğitim", skills: "Yetenekler", certifications: "Sertifikalar", languages: "Diller", projects: "Projeler", publications: "Yayınlar", awards: "Ödüller", volunteer: "Gönüllü Deneyim", references: "Referanslar", custom: "Ek Bilgiler", present: "Halen", contact: "İletişim" },
  zh: { summary: "个人简介", experience: "工作经历", education: "教育背景", skills: "专业技能", certifications: "证书", languages: "语言能力", projects: "项目经历", publications: "出版物", awards: "荣誉奖项", volunteer: "志愿经历", references: "推荐人", custom: "其他信息", present: "至今", contact: "联系方式" },
  ja: { summary: "職務要約", experience: "職歴", education: "学歴", skills: "スキル", certifications: "資格", languages: "語学", projects: "プロジェクト", publications: "著作", awards: "受賞歴", volunteer: "ボランティア活動", references: "推薦者", custom: "その他", present: "現在", contact: "連絡先" },
};

export function headingsFor(locale: string): Labels {
  return RESUME_HEADINGS[locale.split("-")[0]!] ?? RESUME_HEADINGS.en!;
}
