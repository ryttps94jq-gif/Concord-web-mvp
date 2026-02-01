'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react';

export default function CalendarLensPage() {
  useLensNav('calendar');

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { data: events } = useQuery({
    queryKey: ['calendar-events', currentDate.getMonth(), currentDate.getFullYear()],
    queryFn: () =>
      api
        .get('/api/calendar/events', {
          params: {
            month: currentDate.getMonth() + 1,
            year: currentDate.getFullYear(),
          },
        })
        .then((r) => r.data),
  });

  const daysInMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  ).getDate();

  const firstDayOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  ).getDay();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getEventsForDay = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return events?.events?.filter((e: any) => {
      const eventDate = new Date(e.date);
      return eventDate.toDateString() === date.toDateString();
    }) || [];
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📅</span>
          <div>
            <h1 className="text-xl font-bold">Calendar Lens</h1>
            <p className="text-sm text-gray-400">
              Temporal navigation and event management
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 panel p-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="btn-neon p-2">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-semibold">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button onClick={nextMonth} className="btn-neon p-2">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-gray-500 py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before first of month */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayEvents = getEventsForDay(day);
              const isSelected =
                selectedDate?.getDate() === day &&
                selectedDate?.getMonth() === currentDate.getMonth();

              return (
                <button
                  key={day}
                  onClick={() =>
                    setSelectedDate(
                      new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
                    )
                  }
                  className={`aspect-square p-1 rounded-lg transition-colors relative ${
                    isToday(day)
                      ? 'bg-neon-blue/20 text-neon-blue'
                      : isSelected
                      ? 'bg-neon-purple/20 text-neon-purple'
                      : 'hover:bg-lattice-elevated'
                  }`}
                >
                  <span className="text-sm">{day}</span>
                  {dayEvents.length > 0 && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {dayEvents.slice(0, 3).map((_: any, j: number) => (
                        <div
                          key={j}
                          className="w-1 h-1 rounded-full bg-neon-green"
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Event List */}
        <div className="panel p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-neon-blue" />
            {selectedDate
              ? selectedDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })
              : 'Select a date'}
          </h3>

          <div className="space-y-2">
            {selectedDate ? (
              getEventsForDay(selectedDate.getDate()).length > 0 ? (
                getEventsForDay(selectedDate.getDate()).map((event: any) => (
                  <div key={event.id} className="lens-card">
                    <h4 className="font-medium">{event.title}</h4>
                    {event.time && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {event.time}
                      </p>
                    )}
                    {event.location && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {event.location}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm text-center py-4">
                  No events for this day
                </p>
              )
            ) : (
              <p className="text-gray-500 text-sm text-center py-4">
                Click a date to view events
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
