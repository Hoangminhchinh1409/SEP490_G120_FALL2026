import React from 'react';
import { Input, Button } from 'antd';

export default function OrderDriverChatTab({
  orderMessages,
  newMessageText,
  setNewMessageText,
  handleSendMessage
}) {
  return (
    <div className="space-y-4">
      <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
        <div className="text-xs font-bold text-gray-700 mb-2">Kênh liên lạc điều hành hiện trường:</div>
        <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
          {orderMessages.map(msg => (
            <div 
              key={msg.id} 
              className={`p-2.5 rounded-lg text-xs ${msg.role === 'DISPATCHER' ? 'bg-indigo-50 border border-indigo-200 ml-6 text-indigo-950' : 'bg-white border border-gray-200 mr-6 text-gray-800'}`}
            >
              <div className="flex justify-between items-center mb-1 text-[11px]">
                <span className="font-bold">{msg.sender}</span>
                <span className="text-gray-400 font-mono">{msg.time}</span>
              </div>
              <p className="m-0 leading-relaxed">{msg.content}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <Input 
          placeholder="Nhập tin nhắn hướng dẫn hoặc cảnh báo cho tài xế..." 
          value={newMessageText}
          onChange={e => setNewMessageText(e.target.value)}
          onPressEnter={handleSendMessage}
          className="text-xs"
        />
        <Button 
          type="primary" 
          onClick={handleSendMessage}
          className="bg-[#7367f0] hover:bg-[#5e50ee] text-xs font-semibold"
        >
          Gửi tin
        </Button>
      </div>
    </div>
  );
}
