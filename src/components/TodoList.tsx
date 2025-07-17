import React from "react";
import { CheckCircle, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Todo {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
}

interface TodoListProps {
  todos: Todo[];
  title?: string;
  className?: string;
}

export const TodoList: React.FC<TodoListProps> = ({ todos, title, className }) => {
  if (!todos || todos.length === 0) {
    return null;
  }

  const getStatusIcon = (status: Todo['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'pending':
        return <Circle className="h-4 w-4 text-gray-400" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: Todo['priority']) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500 bg-red-50 dark:bg-red-950/20';
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20';
      case 'low':
        return 'border-l-green-500 bg-green-50 dark:bg-green-950/20';
      default:
        return 'border-l-gray-500 bg-gray-50 dark:bg-gray-950/20';
    }
  };

  const getStatusText = (status: Todo['status']) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'pending':
        return 'Pending';
      default:
        return status;
    }
  };

  const completedCount = todos.filter(todo => todo.status === 'completed').length;
  const totalCount = todos.length;

  return (
    <div className={cn("border rounded-lg p-4 bg-slate-50 dark:bg-slate-900 dark:border-slate-700", className)}>
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-slate-800 dark:text-slate-200">{title}</h4>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {completedCount}/{totalCount} completed
          </div>
        </div>
      )}
      
      <div className="space-y-2">
        {todos.map((todo) => (
          <div
            key={todo.id}
            className={cn(
              "flex items-start gap-3 p-3 rounded border-l-4 transition-colors",
              getPriorityColor(todo.priority),
              todo.status === 'completed' && 'opacity-75'
            )}
          >
            <div className="flex-shrink-0 mt-0.5">
              {getStatusIcon(todo.status)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className={cn(
                "text-sm dark:text-slate-300",
                todo.status === 'completed' && 'line-through text-gray-600 dark:text-gray-400'
              )}>
                {todo.content}
              </div>
              
              <div className="flex items-center gap-3 mt-1">
                <span className={cn(
                  "text-xs px-2 py-1 rounded-full",
                  todo.status === 'completed' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                  todo.status === 'in_progress' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                  todo.status === 'pending' && 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300'
                )}>
                  {getStatusText(todo.status)}
                </span>
                
                <span className={cn(
                  "text-xs px-2 py-1 rounded-full",
                  todo.priority === 'high' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                  todo.priority === 'medium' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                  todo.priority === 'low' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                )}>
                  {todo.priority} priority
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {completedCount > 0 && (
        <div className="mt-3 pt-3 border-t dark:border-slate-700">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-green-500 dark:bg-green-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
            <span>{Math.round((completedCount / totalCount) * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
};