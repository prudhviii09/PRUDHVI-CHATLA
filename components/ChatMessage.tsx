import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, Role } from '../types';
import { User, Sparkles } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === Role.USER;

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] md:max-w-[70%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-gray-700' : 'bg-gradient-to-br from-indigo-500 to-purple-600'
        }`}>
          {isUser ? <User size={16} className="text-gray-300" /> : <Sparkles size={16} className="text-white" />}
        </div>

        {/* Content Bubble */}
        <div className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
          
          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-1 justify-end">
              {message.attachments.map((att, idx) => (
                <img 
                  key={idx}
                  src={att.previewUrl} 
                  alt="User upload" 
                  className="h-32 w-auto rounded-lg border border-white/10 shadow-lg object-cover"
                />
              ))}
            </div>
          )}

          {/* Text */}
          <div className={`px-4 py-3 rounded-2xl shadow-sm backdrop-blur-md text-sm leading-relaxed ${
            isUser 
              ? 'bg-white/10 text-white rounded-tr-sm' 
              : 'bg-black/40 border border-white/10 text-gray-100 rounded-tl-sm'
          }`}>
            {message.text ? (
              <ReactMarkdown 
                components={{
                  code({node, className, children, ...props}) {
                    return (
                       <code className={`${className} bg-black/30 rounded px-1 py-0.5 text-xs font-mono`} {...props}>
                        {children}
                      </code>
                    )
                  }
                }}
              >
                {message.text}
              </ReactMarkdown>
            ) : (
              <span className="italic text-gray-400">Thinking...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
