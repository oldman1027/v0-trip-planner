'use client';

import { useState } from 'react';
import { Clock, MapPin, Calendar, ChevronDown, ChevronUp } from 'lucide-react';

interface TransportCardProps {
  booking: {
    id: string;
    from_location: string;
    to_location: string;
    departure_time: string;
    arrival_time: string;
    date: string;
    transport_type: 'flight' | 'train' | 'bus' | 'car' | 'ship';
    flight_number?: string;
    notes?: string;
  };
}

const transportIcons = {
  flight: '✈️',
  train: '🚂',
  bus: '🚌',
  car: '🚗',
  ship: '⛴️'
};

export function TransportTimelineCard({ booking }: TransportCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative group">
      {/* Timeline connector line */}
      <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gradient-to-b from-[#A9D6C5] to-transparent opacity-30" />
      
      {/* Main card */}
      <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all duration-300 hover:border-[#A9D6C5]/40">
        
        {/* Header - Date & Type */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#A9D6C5] to-[#8EC4B2] flex items-center justify-center text-2xl shadow-md">
              {transportIcons[booking.transport_type]}
            </div>
            <div>
              <div className="text-sm text-gray-500 font-medium">
                {booking.transport_type.charAt(0).toUpperCase() + booking.transport_type.slice(1)}
              </div>
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(booking.date).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </div>
            </div>
          </div>

          {booking.flight_number && (
            <div className="px-3 py-1 bg-[#A9D6C5]/10 text-[#A9D6C5] text-sm font-semibold rounded-full">
              {booking.flight_number}
            </div>
          )}
        </div>

        {/* Journey visualization - Horizontal timeline */}
        <div className="relative mb-4">
          <div className="flex items-center justify-between">
            {/* Departure */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-[#A9D6C5] ring-4 ring-[#A9D6C5]/20" />
                <span className="text-xs text-gray-500 font-medium">From</span>
              </div>
              <div className="text-base font-bold text-gray-900 mb-1">
                {booking.from_location}
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Clock className="w-3.5 h-3.5" />
                {booking.departure_time}
              </div>
            </div>

            {/* Connecting arrow */}
            <div className="flex-shrink-0 px-6">
              <div className="relative">
                <div className="h-0.5 w-20 bg-gradient-to-r from-[#A9D6C5] to-[#8EC4B2]" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-t-2 border-r-2 border-[#8EC4B2] rotate-45" />
              </div>
            </div>

            {/* Arrival */}
            <div className="flex-1 text-right">
              <div className="flex items-center justify-end gap-2 mb-2">
                <span className="text-xs text-gray-500 font-medium">To</span>
                <div className="w-3 h-3 rounded-full bg-[#8EC4B2] ring-4 ring-[#8EC4B2]/20" />
              </div>
              <div className="text-base font-bold text-gray-900 mb-1">
                {booking.to_location}
              </div>
              <div className="flex items-center justify-end gap-1 text-sm text-gray-600">
                <Clock className="w-3.5 h-3.5" />
                {booking.arrival_time}
              </div>
            </div>
          </div>
        </div>

        {/* Expandable notes section */}
        {booking.notes && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm text-gray-500 hover:text-[#A9D6C5] transition-colors"
            >
              <span>{expanded ? 'Hide' : 'Show'} Details</span>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            
            {expanded && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-sm text-gray-600">{booking.notes}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
