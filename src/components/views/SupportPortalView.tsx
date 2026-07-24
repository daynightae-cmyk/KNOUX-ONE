/**
 * KNOUX ONE — Support Portal & Ticket Submission Component
 */

import React, { useState } from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { HelpCircle, MessageSquare, Send, CheckCircle2, User, Mail, Shield } from 'lucide-react';

export const SupportPortalView: React.FC = () => {
  const { supportTickets, addSupportTicket, t } = useKnoux();

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('General Inquiry');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [ticketCreatedSuccess, setTicketCreatedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;

    addSupportTicket(subject, category, priority);
    setSubject('');
    setTicketCreatedSuccess(true);
    setTimeout(() => setTicketCreatedSuccess(false), 3000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-900/40 pb-5">
        <div>
          <div className="inline-flex items-center space-x-2 rtl:space-x-reverse px-2.5 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 text-xs font-mono mb-1">
            <HelpCircle className="w-3.5 h-3.5 text-[#8226EE]" />
            <span>MODULE 19 • KNOWLEDGE BASE & TICKET PORTAL</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            {t('Support Portal & Developer Inquiry', 'مركز الدعم والتواصل المباشر')}
          </h1>
          <p className="text-xs text-gray-300 mt-1">
            {t(
              'Submit tickets, report issues, and inquire directly with Eng. Sadek Elgazar (Knoux).',
              'إنشاء تذاكر الدعم الفني وتقديم الاستفسارات مباشرة مع م/ صادق الجزار (Knoux).'
            )}
          </p>
        </div>
      </div>

      {/* Grid: Submit Form & Ticket History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ticket Submission Form */}
        <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-900/40 space-y-4">
          <h3 className="text-sm font-bold text-white font-mono flex items-center space-x-2 rtl:space-x-reverse">
            <MessageSquare className="w-4 h-4 text-[#8226EE]" />
            <span>{t('Open New Support Ticket', 'فتح تذكرة دعم جديدة')}</span>
          </h3>

          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block text-gray-400 font-mono mb-1">{t('Inquiry Subject / Topic', 'عنوان الاستفسار أو المشكلة')}</label>
              <input
                type="text"
                required
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder={t('e.g., Assistance with DISM RestoreHealth source path', 'مثال: استفسار حول كود الباورشيل لمسار DISM')}
                className="w-full bg-purple-950/40 border border-purple-800/50 rounded-xl px-3 py-2 text-white placeholder-purple-400/50 focus:outline-none focus:border-[#8226EE]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-400 font-mono mb-1">{t('Category', 'التصنيف')}</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-purple-950/40 border border-purple-800/50 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#8226EE]"
                >
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Windows Repair">Windows Repair</option>
                  <option value="Winget Post-Format">Winget Post-Format</option>
                  <option value="Feature Request">Feature Request</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-400 font-mono mb-1">{t('Priority', 'الأولوية')}</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as any)}
                  className="w-full bg-purple-950/40 border border-purple-800/50 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#8226EE]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#8226EE] hover:bg-purple-600 text-white font-bold shadow-md shadow-purple-900/40 flex items-center justify-center space-x-2 rtl:space-x-reverse transition-all active:scale-95"
            >
              <Send className="w-4 h-4" />
              <span>{t('Submit Ticket', 'إرسال التذكرة')}</span>
            </button>

            {ticketCreatedSuccess && (
              <p className="text-emerald-400 text-xs font-mono text-center animate-in fade-in">
                {t('Support ticket successfully submitted!', 'تم إنشاء وإرسال التذكرة بنجاح!')}
              </p>
            )}
          </form>
        </div>

        {/* Existing Tickets */}
        <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-900/40 space-y-3">
          <h3 className="text-sm font-bold text-white font-mono flex items-center space-x-2 rtl:space-x-reverse">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>{t('Active Ticket History', 'سجل التذاكر النشطة')}</span>
          </h3>

          <div className="space-y-2">
            {supportTickets.map(ticket => (
              <div key={ticket.id} className="p-3 rounded-xl bg-purple-950/30 border border-purple-900/30 text-xs font-mono space-y-1">
                <div className="flex justify-between font-bold text-white">
                  <span>{ticket.id}: {ticket.subject}</span>
                  <span className="text-purple-300">{ticket.status}</span>
                </div>
                <p className="text-xs text-gray-400">{ticket.category} • Created {ticket.createdAt}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
