import { useState } from "react";
import { Megaphone, X, ShieldAlert } from "lucide-react";

const STORAGE_KEY = "kimi-announcement-v1";

const ANNOUNCEMENT_PARAGRAPHS = [
  {
    title: "重要提醒",
    text: "大家别私下相信外人！很多人只是自建群主，对外谎称项目老板，身份全是自己编造的。我们才是 Kimi.Ai 真正官方项目团队，项目没有单独老板，团队成员自己包装，kimi 系列全部是团队统一运营，所有权威消息只看我们这边，别被外人误导踩坑！",
  },
  {
    title: "各位成员注意",
    text: "在此统一郑重说明：全网唯一官方项目团队仅我们这边。请大家切勿轻信私下接触你的陌生人，部分人员仅自行搭建社群，对外谎称项目老板、内部高层，相关身份均为虚假编造。Kimi.Ai 不存在单独老板，整体由官方团队项目组统一运营，一切官方通知、信息仅由本团队发布，任何非我方人员的私下承诺、私下交易均无保障，谨防受骗！",
  },
];

export function Announcement() {
  const [hidden, setHidden] = useState(() => localStorage.getItem(STORAGE_KEY) === "1");

  if (hidden) return null;

  return (
    <div className="relative border-b border-[#FFB020]/25 bg-gradient-to-r from-[#3A2508]/80 via-[#2A1B06]/80 to-[#1A150A]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1800px] items-start gap-3 px-4 py-3 lg:px-6">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFB020]/15 text-[#FFB020]">
          <Megaphone className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-[#FFB020]/15 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#FFC44D]">
              <ShieldAlert className="h-3 w-3" />
              官方公告
            </span>
            <span className="animate-pulse text-[11px] font-medium text-[#FF6B6B]">重要 · 请仔细阅读</span>
          </div>
          <div className="space-y-1.5">
            {ANNOUNCEMENT_PARAGRAPHS.map((item) => (
              <p key={item.title} className="text-[13px] leading-relaxed text-[#F5E6C8]">
                <span className="font-bold text-[#FFC44D]">{item.title}：</span>
                {item.text}
              </p>
            ))}
          </div>
        </div>
        <button
          onClick={() => {
            localStorage.setItem(STORAGE_KEY, "1");
            setHidden(true);
          }}
          className="mt-0.5 shrink-0 rounded-lg p-1.5 text-[#F5E6C8]/50 transition-colors hover:bg-white/10 hover:text-[#F5E6C8]"
          aria-label="关闭公告"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
