
import jsPDF from 'jspdf';
import { Task } from '@/hooks/useTasks';
import { Habit, HabitLog } from '@/hooks/useHabits';

export const exportToPDF = async (
  tasks: Task[],
  habits: Habit[],
  logs: HabitLog[]
) => {
  const pdf = new jsPDF();
  let yPosition = 20;
  const lineHeight = 8;
  const pageHeight = pdf.internal.pageSize.height;

  // Helper function to add new page if needed
  const checkPageBreak = () => {
    if (yPosition > pageHeight - 20) {
      pdf.addPage();
      yPosition = 20;
    }
  };

  // Title
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Monotask - Productivity Report', 20, yPosition);
  yPosition += lineHeight * 2;

  // Export date
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, yPosition);
  yPosition += lineHeight * 2;

  // Tasks Section
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Tasks', 20, yPosition);
  yPosition += lineHeight;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');

  const completedTasks = tasks.filter(t => t.status === 'completed');
  const pendingTasks = tasks.filter(t => t.status === 'pending');

  pdf.text(`Total Tasks: ${tasks.length}`, 20, yPosition);
  yPosition += lineHeight;
  pdf.text(`Completed: ${completedTasks.length}`, 20, yPosition);
  yPosition += lineHeight;
  pdf.text(`Pending: ${pendingTasks.length}`, 20, yPosition);
  yPosition += lineHeight * 2;

  // Task Details
  if (tasks.length > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Task Details:', 20, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');

    tasks.forEach((task, index) => {
      checkPageBreak();
      
      const status = task.status === 'completed' ? '✓' : '○';
      const dueDate = task.due_date ? ` (Due: ${task.due_date})` : '';
      const priority = task.priority ? ` [${task.priority.toUpperCase()}]` : '';
      
      pdf.text(`${status} ${task.title}${priority}${dueDate}`, 25, yPosition);
      yPosition += lineHeight;
      
      if (task.description) {
        pdf.setFontSize(8);
        pdf.text(`   ${task.description}`, 25, yPosition);
        yPosition += lineHeight;
        pdf.setFontSize(10);
      }
    });
  }

  yPosition += lineHeight;

  // Habits Section
  checkPageBreak();
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Habits', 20, yPosition);
  yPosition += lineHeight;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Total Habits: ${habits.length}`, 20, yPosition);
  yPosition += lineHeight * 2;

  // Habit Details
  if (habits.length > 0) {
    pdf.setFont('helvetica', 'bold');
    pdf.text('Habit Details:', 20, yPosition);
    yPosition += lineHeight;
    pdf.setFont('helvetica', 'normal');

    habits.forEach((habit, index) => {
      checkPageBreak();
      
      const frequency = habit.frequency ? ` (${habit.frequency})` : '';
      const time = habit.preferred_time ? ` at ${habit.preferred_time}` : '';
      
      pdf.text(`• ${habit.name}${frequency}${time}`, 25, yPosition);
      yPosition += lineHeight;
      
      if (habit.description) {
        pdf.setFontSize(8);
        pdf.text(`   ${habit.description}`, 25, yPosition);
        yPosition += lineHeight;
        pdf.setFontSize(10);
      }

      // Show recent logs for this habit
      const habitLogs = logs.filter(log => log.habit_id === habit.id).slice(0, 5);
      if (habitLogs.length > 0) {
        pdf.setFontSize(8);
        pdf.text('   Recent activity:', 25, yPosition);
        yPosition += lineHeight - 2;
        
        habitLogs.forEach(log => {
          const statusIcon = log.status === 'completed' ? '✓' : 
                           log.status === 'skipped' ? '○' : '✗';
          pdf.text(`     ${log.date}: ${statusIcon} ${log.status}`, 25, yPosition);
          yPosition += lineHeight - 2;
        });
        pdf.setFontSize(10);
        yPosition += 2;
      }
    });
  }

  // Statistics Section
  yPosition += lineHeight;
  checkPageBreak();
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Statistics', 20, yPosition);
  yPosition += lineHeight;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');

  const completionRate = tasks.length > 0 ? (completedTasks.length / tasks.length * 100).toFixed(1) : '0';
  pdf.text(`Task Completion Rate: ${completionRate}%`, 20, yPosition);
  yPosition += lineHeight;

  const totalHabitLogs = logs.length;
  const completedHabitLogs = logs.filter(log => log.status === 'completed').length;
  const habitCompletionRate = totalHabitLogs > 0 ? (completedHabitLogs / totalHabitLogs * 100).toFixed(1) : '0';
  pdf.text(`Habit Completion Rate: ${habitCompletionRate}%`, 20, yPosition);
  yPosition += lineHeight;

  // Save PDF
  pdf.save('monotask-report.pdf');
};
