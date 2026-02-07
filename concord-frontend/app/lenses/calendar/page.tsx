'use client';

import { useState, useEffect } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, MapPin,
  Plus, X, Edit2, Trash2, Bell, Repeat, Users,
  Search, Settings, Check, Video,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  color: string;
  category: string;
  location?: string;
  url?: string;
  attendees?: { id: string; name: string; email: string; status: 'accepted' | 'declined' | 'pending' }[];
  reminders?: { time: number; unit: 'minutes' | 'hours' | 'days' }[];
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate?: Date;
    daysOfWeek?: number[];
  };
  isPrivate?: boolean;
  dtuId?: string;
}

interface CalendarCategory {
  id: string;
  name: string;
  color: string;
  visible: boolean;
}

type ViewMode = 'month' | 'week' | 'day' | 'agenda';

const COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Red', value: '#ef4444' },
];

const MOCK_CATEGORIES: CalendarCategory[] = [
  { id: '1', name: 'Work', color: '#3b82f6', visible: true },
  { id: '2', name: 'Personal', color: '#22c55e', visible: true },
  { id: '3', name: 'DTU Events', color: '#8b5cf6', visible: true },
  { id: '4', name: 'Meetings', color: '#f97316', visible: true },
  { id: '5', name: 'Reminders', color: '#eab308', visible: true },
];

const generateMockEvents = (currentDate: Date): CalendarEvent[] => {
  const events: CalendarEvent[] = [];
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Add some mock events
  events.push({
    id: '1',
    title: 'DTU Council Meeting',
    description: 'Weekly review of global DTU proposals',
    startDate: new Date(year, month, 15, 10, 0),
    endDate: new Date(year, month, 15, 11, 30),
    allDay: false,
    color: '#8b5cf6',
    category: 'DTU Events',
    location: 'Virtual - Lattice Room',
    attendees: [
      { id: '1', name: 'Alice Chen', email: 'alice@example.com', status: 'accepted' },
      { id: '2', name: 'Bob Smith', email: 'bob@example.com', status: 'pending' },
    ],
    reminders: [{ time: 30, unit: 'minutes' }],
  });

  events.push({
    id: '2',
    title: 'Sprint Planning',
    description: 'Plan next sprint tasks and priorities',
    startDate: new Date(year, month, 8, 9, 0),
    endDate: new Date(year, month, 8, 10, 0),
    allDay: false,
    color: '#3b82f6',
    category: 'Work',
    url: 'https://meet.example.com/sprint',
    reminders: [{ time: 15, unit: 'minutes' }],
    recurrence: { frequency: 'weekly', interval: 2, daysOfWeek: [1] },
  });

  events.push({
    id: '3',
    title: 'Quarterly Review',
    description: 'Review Q1 performance and metrics',
    startDate: new Date(year, month, 20, 14, 0),
    endDate: new Date(year, month, 20, 16, 0),
    allDay: false,
    color: '#f97316',
    category: 'Meetings',
    location: 'Conference Room A',
  });

  events.push({
    id: '4',
    title: 'Product Launch',
    startDate: new Date(year, month, 25, 0, 0),
    endDate: new Date(year, month, 25, 23, 59),
    allDay: true,
    color: '#22c55e',
    category: 'Work',
    description: 'Major product release day',
  });

  events.push({
    id: '5',
    title: 'Dentist Appointment',
    startDate: new Date(year, month, 12, 15, 30),
    endDate: new Date(year, month, 12, 16, 30),
    allDay: false,
    color: '#22c55e',
    category: 'Personal',
    location: '123 Health St',
    isPrivate: true,
  });

  events.push({
    id: '6',
    title: 'Team Sync',
    startDate: new Date(year, month, currentDate.getDate(), 11, 0),
    endDate: new Date(year, month, currentDate.getDate(), 11, 30),
    allDay: false,
    color: '#3b82f6',
    category: 'Work',
    recurrence: { frequency: 'daily', interval: 1 },
  });

  events.push({
    id: '7',
    title: 'DTU Synthesis Complete',
    startDate: new Date(year, month, currentDate.getDate() + 2, 8, 0),
    endDate: new Date(year, month, currentDate.getDate() + 2, 8, 0),
    allDay: false,
    color: '#8b5cf6',
    category: 'DTU Events',
    dtuId: 'dtu_12345',
  });

  return events;
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function CalendarLensPage() {
  useLensNav('calendar');
  const _queryClient = useQueryClient();

  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [categories, setCategories] = useState<CalendarCategory[]>(MOCK_CATEGORIES);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [_searchQuery, _setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);

  // New event form
  const [newEvent, setNewEvent] = useState<Partial<CalendarEvent>>({
    title: '',
    description: '',
    startDate: new Date(),
    endDate: new Date(),
    allDay: false,
    color: COLORS[0].value,
    category: 'Work',
  });

  // Initialize events
  useEffect(() => {
    setEvents(generateMockEvents(currentDate));
  }, []);

  // Calendar calculations
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getWeekDates = (date: Date) => {
    const day = date.getDay();
    const diff = date.getDate() - day;
    const weekStart = new Date(date);
    weekStart.setDate(diff);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  };

  const getHoursArray = () => Array.from({ length: 24 }, (_, i) => i);

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  const getEventsForDay = (date: Date) => {
    return events.filter((event) => {
      const eventStart = new Date(event.startDate);
      const _eventEnd = new Date(event.endDate);
      const categoryVisible = categories.find((c) => c.name === event.category)?.visible ?? true;

      if (!categoryVisible) return false;

      if (event.allDay) {
        return isSameDay(eventStart, date);
      }

      return isSameDay(eventStart, date);
    });
  };

  const getEventsForHour = (date: Date, hour: number) => {
    return events.filter((event) => {
      const eventStart = new Date(event.startDate);
      return (
        isSameDay(eventStart, date) &&
        !event.allDay &&
        eventStart.getHours() === hour
      );
    });
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + direction * 7);
    setCurrentDate(newDate);
  };

  const navigateDay = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + direction);
    setCurrentDate(newDate);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatDateRange = (start: Date, end: Date, allDay: boolean) => {
    if (allDay) return 'All day';
    return `${formatTime(start)} - ${formatTime(end)}`;
  };

  const handleCreateEvent = () => {
    if (!newEvent.title) return;

    const event: CalendarEvent = {
      id: Date.now().toString(),
      title: newEvent.title,
      description: newEvent.description,
      startDate: newEvent.startDate || new Date(),
      endDate: newEvent.endDate || new Date(),
      allDay: newEvent.allDay || false,
      color: newEvent.color || COLORS[0].value,
      category: newEvent.category || 'Work',
      location: newEvent.location,
      url: newEvent.url,
    };

    setEvents([...events, event]);
    setShowCreateModal(false);
    setNewEvent({
      title: '',
      description: '',
      startDate: new Date(),
      endDate: new Date(),
      allDay: false,
      color: COLORS[0].value,
      category: 'Work',
    });
  };

  const handleDeleteEvent = (eventId: string) => {
    setEvents(events.filter((e) => e.id !== eventId));
    setSelectedEvent(null);
    setShowEventModal(false);
  };

  const toggleCategoryVisibility = (categoryId: string) => {
    setCategories(
      categories.map((c) =>
        c.id === categoryId ? { ...c, visible: !c.visible } : c
      )
    );
  };

  const renderMonthView = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const prevMonthDays = getDaysInMonth(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

    const days: (Date | null)[] = [];

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, prevMonthDays - i);
      days.push(d);
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
    }

    // Next month days
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i));
    }

    return (
      <div className="flex-1 flex flex-col">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-lattice-border">
          {DAY_NAMES.map((day) => (
            <div key={day} className="py-3 text-center text-sm font-medium text-gray-400">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex-1 grid grid-cols-7 grid-rows-6">
          {days.map((date, index) => {
            if (!date) return <div key={index} />;

            const isCurrentMonth = date.getMonth() === currentDate.getMonth();
            const dayEvents = getEventsForDay(date);
            const isSelected = isSameDay(date, selectedDate);

            return (
              <div
                key={index}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  'min-h-[100px] border-b border-r border-lattice-border p-1 cursor-pointer transition-colors',
                  !isCurrentMonth && 'bg-lattice-deep/30',
                  isSelected && 'bg-neon-cyan/5',
                  isToday(date) && 'bg-neon-blue/10'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      'w-7 h-7 flex items-center justify-center rounded-full text-sm',
                      isToday(date) && 'bg-neon-blue text-white',
                      !isCurrentMonth && 'text-gray-500'
                    )}
                  >
                    {date.getDate()}
                  </span>
                  {dayEvents.length > 3 && (
                    <span className="text-xs text-gray-400">+{dayEvents.length - 3}</span>
                  )}
                </div>

                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <button
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEvent(event);
                        setShowEventModal(true);
                      }}
                      className="w-full text-left px-1.5 py-0.5 rounded text-xs truncate font-medium transition-colors hover:opacity-80"
                      style={{ backgroundColor: event.color + '30', color: event.color }}
                    >
                      {!event.allDay && (
                        <span className="opacity-70">{formatTime(new Date(event.startDate))} </span>
                      )}
                      {event.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDates = getWeekDates(currentDate);
    const hours = getHoursArray();

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex border-b border-lattice-border">
          <div className="w-16 flex-shrink-0" />
          {weekDates.map((date, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 py-2 text-center border-l border-lattice-border',
                isToday(date) && 'bg-neon-blue/10'
              )}
            >
              <p className="text-xs text-gray-400">{DAY_NAMES[i]}</p>
              <p
                className={cn(
                  'text-lg font-semibold',
                  isToday(date) && 'text-neon-blue'
                )}
              >
                {date.getDate()}
              </p>
            </div>
          ))}
        </div>

        {/* All-day events */}
        <div className="flex border-b border-lattice-border min-h-[40px]">
          <div className="w-16 flex-shrink-0 flex items-center justify-center text-xs text-gray-400">
            All day
          </div>
          {weekDates.map((date, i) => {
            const allDayEvents = getEventsForDay(date).filter((e) => e.allDay);
            return (
              <div key={i} className="flex-1 border-l border-lattice-border p-1 space-y-1">
                {allDayEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => {
                      setSelectedEvent(event);
                      setShowEventModal(true);
                    }}
                    className="w-full text-left px-2 py-1 rounded text-xs font-medium truncate"
                    style={{ backgroundColor: event.color + '30', color: event.color }}
                  >
                    {event.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="relative">
            {hours.map((hour) => (
              <div key={hour} className="flex h-16 border-b border-lattice-border/50">
                <div className="w-16 flex-shrink-0 flex items-start justify-center -mt-2 text-xs text-gray-400">
                  {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                </div>
                {weekDates.map((date, i) => {
                  const hourEvents = getEventsForHour(date, hour);
                  return (
                    <div
                      key={i}
                      className="flex-1 border-l border-lattice-border/50 relative"
                      onClick={() => {
                        const newStart = new Date(date);
                        newStart.setHours(hour, 0, 0, 0);
                        const newEnd = new Date(newStart);
                        newEnd.setHours(hour + 1);
                        setNewEvent({ ...newEvent, startDate: newStart, endDate: newEnd });
                        setShowCreateModal(true);
                      }}
                    >
                      {hourEvents.map((event) => {
                        const start = new Date(event.startDate);
                        const end = new Date(event.endDate);
                        const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                        const top = (start.getMinutes() / 60) * 64;
                        const height = Math.max(duration * 64, 20);

                        return (
                          <button
                            key={event.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(event);
                              setShowEventModal(true);
                            }}
                            className="absolute left-1 right-1 rounded px-2 py-1 text-xs font-medium overflow-hidden z-10"
                            style={{
                              top: `${top}px`,
                              height: `${height}px`,
                              backgroundColor: event.color + '30',
                              color: event.color,
                              borderLeft: `3px solid ${event.color}`,
                            }}
                          >
                            <p className="font-semibold truncate">{event.title}</p>
                            <p className="opacity-70 text-[10px]">{formatTime(start)}</p>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const hours = getHoursArray();
    const dayEvents = getEventsForDay(selectedDate);
    const allDayEvents = dayEvents.filter((e) => e.allDay);

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="py-4 text-center border-b border-lattice-border">
          <p className="text-sm text-gray-400">{DAY_NAMES_FULL[selectedDate.getDay()]}</p>
          <p className={cn('text-3xl font-bold', isToday(selectedDate) && 'text-neon-blue')}>
            {selectedDate.getDate()}
          </p>
          <p className="text-sm text-gray-400">
            {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getFullYear()}
          </p>
        </div>

        {/* All-day events */}
        {allDayEvents.length > 0 && (
          <div className="border-b border-lattice-border p-2 space-y-1">
            <p className="text-xs text-gray-400 mb-1">All day</p>
            {allDayEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => {
                  setSelectedEvent(event);
                  setShowEventModal(true);
                }}
                className="w-full text-left px-3 py-2 rounded font-medium"
                style={{ backgroundColor: event.color + '30', color: event.color }}
              >
                {event.title}
              </button>
            ))}
          </div>
        )}

        {/* Time grid */}
        <div className="flex-1 overflow-y-auto">
          {hours.map((hour) => {
            const hourEvents = getEventsForHour(selectedDate, hour);

            return (
              <div key={hour} className="flex h-20 border-b border-lattice-border/50">
                <div className="w-20 flex-shrink-0 flex items-start justify-center pt-1 text-sm text-gray-400">
                  {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                </div>
                <div
                  className="flex-1 relative border-l border-lattice-border/50"
                  onClick={() => {
                    const newStart = new Date(selectedDate);
                    newStart.setHours(hour, 0, 0, 0);
                    const newEnd = new Date(newStart);
                    newEnd.setHours(hour + 1);
                    setNewEvent({ ...newEvent, startDate: newStart, endDate: newEnd });
                    setShowCreateModal(true);
                  }}
                >
                  {hourEvents.map((event) => {
                    const start = new Date(event.startDate);
                    const end = new Date(event.endDate);
                    const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                    const top = (start.getMinutes() / 60) * 80;
                    const height = Math.max(duration * 80, 30);

                    return (
                      <button
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(event);
                          setShowEventModal(true);
                        }}
                        className="absolute left-2 right-2 rounded-lg px-3 py-2 text-sm overflow-hidden"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          backgroundColor: event.color + '30',
                          color: event.color,
                          borderLeft: `4px solid ${event.color}`,
                        }}
                      >
                        <p className="font-semibold">{event.title}</p>
                        <p className="text-xs opacity-70">
                          {formatDateRange(start, end, event.allDay)}
                        </p>
                        {event.location && (
                          <p className="text-xs opacity-70 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {event.location}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAgendaView = () => {
    const upcomingEvents = events
      .filter((e) => new Date(e.startDate) >= new Date())
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 30);

    const groupedEvents: { [key: string]: CalendarEvent[] } = {};
    upcomingEvents.forEach((event) => {
      const dateKey = new Date(event.startDate).toDateString();
      if (!groupedEvents[dateKey]) groupedEvents[dateKey] = [];
      groupedEvents[dateKey].push(event);
    });

    return (
      <div className="flex-1 overflow-y-auto p-4">
        {Object.entries(groupedEvents).map(([dateKey, dayEvents]) => {
          const date = new Date(dateKey);
          return (
            <div key={dateKey} className="mb-6">
              <div className="flex items-center gap-4 mb-3">
                <div
                  className={cn(
                    'w-12 h-12 rounded-lg flex flex-col items-center justify-center',
                    isToday(date) ? 'bg-neon-blue text-white' : 'bg-lattice-elevated'
                  )}
                >
                  <span className="text-xs">{DAY_NAMES[date.getDay()]}</span>
                  <span className="text-lg font-bold">{date.getDate()}</span>
                </div>
                <div>
                  <p className="font-semibold">{DAY_NAMES_FULL[date.getDay()]}</p>
                  <p className="text-sm text-gray-400">
                    {MONTH_NAMES[date.getMonth()]} {date.getFullYear()}
                  </p>
                </div>
              </div>

              <div className="space-y-2 ml-16">
                {dayEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => {
                      setSelectedEvent(event);
                      setShowEventModal(true);
                    }}
                    className="w-full text-left p-3 rounded-lg hover:bg-lattice-elevated transition-colors"
                    style={{ borderLeft: `4px solid ${event.color}` }}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{event.title}</h4>
                      <span className="text-sm text-gray-400">
                        {formatDateRange(new Date(event.startDate), new Date(event.endDate), event.allDay)}
                      </span>
                    </div>
                    {event.location && (
                      <p className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />
                        {event.location}
                      </p>
                    )}
                    {event.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{event.description}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {upcomingEvents.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <CalendarIcon className="w-16 h-16 mb-4 opacity-30" />
            <p>No upcoming events</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 btn-neon"
            >
              Create Event
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderSidebar = () => (
    <AnimatePresence>
      {showSidebar && (
        <motion.aside
          initial={{ width: 0 }}
          animate={{ width: 280 }}
          exit={{ width: 0 }}
          className="border-r border-lattice-border bg-lattice-surface/30 overflow-hidden flex-shrink-0"
        >
          <div className="w-70 p-4 space-y-6">
            {/* Mini calendar */}
            <div className="panel p-3">
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => navigateMonth(-1)} className="p-1 rounded hover:bg-lattice-elevated">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium">
                  {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
                </span>
                <button onClick={() => navigateMonth(1)} className="p-1 rounded hover:bg-lattice-elevated">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {DAY_NAMES.map((day) => (
                  <div key={day} className="text-[10px] text-gray-400 py-1">
                    {day[0]}
                  </div>
                ))}

                {(() => {
                  const firstDay = getFirstDayOfMonth(currentDate);
                  const daysInMonth = getDaysInMonth(currentDate);
                  const days = [];

                  for (let i = 0; i < firstDay; i++) {
                    days.push(<div key={`empty-${i}`} />);
                  }

                  for (let i = 1; i <= daysInMonth; i++) {
                    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
                    const hasEvents = getEventsForDay(date).length > 0;

                    days.push(
                      <button
                        key={i}
                        onClick={() => setSelectedDate(date)}
                        className={cn(
                          'w-7 h-7 rounded-full text-xs transition-colors relative',
                          isToday(date) && 'bg-neon-blue text-white',
                          isSameDay(date, selectedDate) && !isToday(date) && 'bg-neon-cyan/20 text-neon-cyan',
                          !isToday(date) && !isSameDay(date, selectedDate) && 'hover:bg-lattice-elevated'
                        )}
                      >
                        {i}
                        {hasEvents && !isToday(date) && (
                          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-neon-cyan" />
                        )}
                      </button>
                    );
                  }

                  return days;
                })()}
              </div>
            </div>

            {/* Create button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full btn-neon flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Event
            </button>

            {/* Categories */}
            <div>
              <h4 className="text-sm font-medium mb-3">Calendars</h4>
              <div className="space-y-2">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => toggleCategoryVisibility(category.id)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-lattice-elevated transition-colors"
                  >
                    <div
                      className={cn(
                        'w-4 h-4 rounded flex items-center justify-center',
                        category.visible ? 'opacity-100' : 'opacity-30'
                      )}
                      style={{ backgroundColor: category.color }}
                    >
                      {category.visible && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className={cn('text-sm', !category.visible && 'text-gray-500')}>
                      {category.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Selected date events */}
            <div>
              <h4 className="text-sm font-medium mb-3">
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h4>
              <div className="space-y-2">
                {getEventsForDay(selectedDate).length > 0 ? (
                  getEventsForDay(selectedDate).map((event) => (
                    <button
                      key={event.id}
                      onClick={() => {
                        setSelectedEvent(event);
                        setShowEventModal(true);
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-lattice-elevated transition-colors"
                      style={{ borderLeft: `3px solid ${event.color}` }}
                    >
                      <p className="text-sm font-medium">{event.title}</p>
                      <p className="text-xs text-gray-400">
                        {formatDateRange(new Date(event.startDate), new Date(event.endDate), event.allDay)}
                      </p>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">No events</p>
                )}
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-lattice-border">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 rounded-lg hover:bg-lattice-elevated text-gray-400"
          >
            <CalendarIcon className="w-5 h-5" />
          </button>

          <button onClick={goToToday} className="px-4 py-2 rounded-lg border border-lattice-border hover:bg-lattice-elevated text-sm font-medium">
            Today
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (viewMode === 'month') navigateMonth(-1);
                else if (viewMode === 'week') navigateWeek(-1);
                else navigateDay(-1);
              }}
              className="p-2 rounded-lg hover:bg-lattice-elevated"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                if (viewMode === 'month') navigateMonth(1);
                else if (viewMode === 'week') navigateWeek(1);
                else navigateDay(1);
              }}
              className="p-2 rounded-lg hover:bg-lattice-elevated"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <h1 className="text-xl font-semibold">
            {viewMode === 'month' && `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
            {viewMode === 'week' && `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
            {viewMode === 'day' && selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            {viewMode === 'agenda' && 'Agenda'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode selector */}
          <div className="flex items-center bg-lattice-deep rounded-lg p-1">
            {(['day', 'week', 'month', 'agenda'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors',
                  viewMode === mode
                    ? 'bg-neon-cyan/20 text-neon-cyan'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                {mode}
              </button>
            ))}
          </div>

          <button className="p-2 rounded-lg hover:bg-lattice-elevated text-gray-400">
            <Search className="w-5 h-5" />
          </button>
          <button className="p-2 rounded-lg hover:bg-lattice-elevated text-gray-400">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {renderSidebar()}

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden bg-lattice-deep">
          {viewMode === 'month' && renderMonthView()}
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'day' && renderDayView()}
          {viewMode === 'agenda' && renderAgendaView()}
        </main>
      </div>

      {/* Event detail modal */}
      <AnimatePresence>
        {showEventModal && selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowEventModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-lattice-surface border border-lattice-border rounded-xl p-6 max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: selectedEvent.color }}
                  />
                  <h2 className="text-xl font-bold">{selectedEvent.title}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 rounded-lg hover:bg-lattice-elevated text-gray-400">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteEvent(selectedEvent.id)}
                    className="p-2 rounded-lg hover:bg-lattice-elevated text-gray-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowEventModal(false)}
                    className="p-2 rounded-lg hover:bg-lattice-elevated text-gray-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-gray-400">
                  <Clock className="w-5 h-5" />
                  <div>
                    <p>
                      {new Date(selectedEvent.startDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-sm">
                      {formatDateRange(
                        new Date(selectedEvent.startDate),
                        new Date(selectedEvent.endDate),
                        selectedEvent.allDay
                      )}
                    </p>
                  </div>
                </div>

                {selectedEvent.location && (
                  <div className="flex items-center gap-3 text-gray-400">
                    <MapPin className="w-5 h-5" />
                    <span>{selectedEvent.location}</span>
                  </div>
                )}

                {selectedEvent.url && (
                  <div className="flex items-center gap-3 text-gray-400">
                    <Video className="w-5 h-5" />
                    <a href={selectedEvent.url} className="text-neon-cyan hover:underline">
                      Join meeting
                    </a>
                  </div>
                )}

                {selectedEvent.recurrence && (
                  <div className="flex items-center gap-3 text-gray-400">
                    <Repeat className="w-5 h-5" />
                    <span className="capitalize">
                      Repeats {selectedEvent.recurrence.frequency}
                      {selectedEvent.recurrence.interval > 1 && ` every ${selectedEvent.recurrence.interval}`}
                    </span>
                  </div>
                )}

                {selectedEvent.reminders && selectedEvent.reminders.length > 0 && (
                  <div className="flex items-center gap-3 text-gray-400">
                    <Bell className="w-5 h-5" />
                    <span>
                      {selectedEvent.reminders.map((r) => `${r.time} ${r.unit}`).join(', ')} before
                    </span>
                  </div>
                )}

                {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                  <div className="flex items-start gap-3 text-gray-400">
                    <Users className="w-5 h-5 mt-0.5" />
                    <div className="space-y-1">
                      {selectedEvent.attendees.map((attendee) => (
                        <div key={attendee.id} className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
                          <span className="text-sm">{attendee.name}</span>
                          <span
                            className={cn(
                              'text-xs px-2 py-0.5 rounded',
                              attendee.status === 'accepted' && 'bg-green-500/20 text-green-400',
                              attendee.status === 'declined' && 'bg-red-500/20 text-red-400',
                              attendee.status === 'pending' && 'bg-yellow-500/20 text-yellow-400'
                            )}
                          >
                            {attendee.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedEvent.description && (
                  <div className="pt-4 border-t border-lattice-border">
                    <p className="text-gray-300">{selectedEvent.description}</p>
                  </div>
                )}

                {selectedEvent.dtuId && (
                  <div className="pt-4 border-t border-lattice-border">
                    <button className="flex items-center gap-2 text-neon-cyan hover:underline">
                      <ExternalLink className="w-4 h-4" />
                      View linked DTU
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create event modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-lattice-surface border border-lattice-border rounded-xl p-6 max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Create Event</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 rounded-lg hover:bg-lattice-elevated text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={newEvent.title || ''}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    placeholder="Add title"
                    className="w-full bg-transparent text-xl font-semibold focus:outline-none placeholder-gray-500"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newEvent.allDay}
                      onChange={(e) => setNewEvent({ ...newEvent, allDay: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm">All day</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Start</label>
                    <input
                      type="datetime-local"
                      value={newEvent.startDate?.toISOString().slice(0, 16) || ''}
                      onChange={(e) => setNewEvent({ ...newEvent, startDate: new Date(e.target.value) })}
                      className="w-full bg-lattice-deep rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neon-cyan"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">End</label>
                    <input
                      type="datetime-local"
                      value={newEvent.endDate?.toISOString().slice(0, 16) || ''}
                      onChange={(e) => setNewEvent({ ...newEvent, endDate: new Date(e.target.value) })}
                      className="w-full bg-lattice-deep rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neon-cyan"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Category</label>
                  <select
                    value={newEvent.category}
                    onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
                    className="w-full bg-lattice-deep rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neon-cyan"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Color</label>
                  <div className="flex items-center gap-2">
                    {COLORS.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => setNewEvent({ ...newEvent, color: color.value })}
                        className={cn(
                          'w-8 h-8 rounded-full transition-transform',
                          newEvent.color === color.value && 'ring-2 ring-white scale-110'
                        )}
                        style={{ backgroundColor: color.value }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Location (optional)</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={newEvent.location || ''}
                      onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                      placeholder="Add location"
                      className="w-full bg-lattice-deep rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neon-cyan"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Description (optional)</label>
                  <textarea
                    value={newEvent.description || ''}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    placeholder="Add description"
                    rows={3}
                    className="w-full bg-lattice-deep rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-neon-cyan resize-none"
                  />
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-2 rounded-lg border border-lattice-border hover:bg-lattice-elevated transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateEvent}
                    disabled={!newEvent.title}
                    className="flex-1 py-2 rounded-lg bg-neon-cyan text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
