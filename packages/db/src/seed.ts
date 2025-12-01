import { db, goals, tasks, habits, habitLogs } from "./index";

/**
 * Seed script for development and testing
 * This creates sample data for a test user
 */

const TEST_USER_ID = "test-user-123";

async function seed() {
	console.log("🌱 Seeding database...");

	try {
		// Create sample goals
		const sampleGoals = [
			{
				id: crypto.randomUUID(),
				userId: TEST_USER_ID,
				title: "Get Fit and Healthy",
				description: "Improve overall health and fitness",
				category: "Health",
				startDate: new Date("2025-01-01"),
				endDate: new Date("2025-12-31"),
				status: "active" as const,
				progress: 25,
			},
			{
				id: crypto.randomUUID(),
				userId: TEST_USER_ID,
				title: "Learn TypeScript",
				description: "Master TypeScript and modern web development",
				category: "Learning",
				startDate: new Date("2025-01-01"),
				endDate: new Date("2025-06-30"),
				status: "active" as const,
				progress: 60,
			},
			{
				id: crypto.randomUUID(),
				userId: TEST_USER_ID,
				title: "Build Side Project",
				description: "Launch a successful SaaS product",
				category: "Work",
				startDate: new Date("2025-02-01"),
				endDate: new Date("2025-08-31"),
				status: "active" as const,
				progress: 10,
			},
		];

		await db.insert(goals).values(sampleGoals);
		console.log("✅ Created sample goals");

		// Destructure goals for type-safe access
		const [fitnessGoal, learningGoal, projectGoal] = sampleGoals;
		
		// Assert that all goals were created successfully
		if (!fitnessGoal || !learningGoal || !projectGoal) {
			throw new Error("Failed to create sample goals");
		}

		// Create sample tasks
		const sampleTasks = [
			{
				id: crypto.randomUUID(),
				userId: TEST_USER_ID,
				goalId: fitnessGoal.id,
				title: "Go for a 30-minute run",
				description: "Morning cardio session",
				dueDate: new Date(),
				status: "pending" as const,
				priority: "high" as const,
				isRecurring: true,
				recurrenceRule: "FREQ=DAILY",
			},
			{
				id: crypto.randomUUID(),
				userId: TEST_USER_ID,
				goalId: learningGoal.id,
				title: "Complete TypeScript course module 5",
				description: "Advanced types and generics",
				dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
				status: "pending" as const,
				priority: "medium" as const,
				isRecurring: false,
			},
			{
				id: crypto.randomUUID(),
				userId: TEST_USER_ID,
				goalId: projectGoal.id,
				title: "Design landing page mockup",
				description: "Create Figma designs for the product landing page",
				dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
				status: "pending" as const,
				priority: "high" as const,
				isRecurring: false,
			},
			{
				id: crypto.randomUUID(),
				userId: TEST_USER_ID,
				title: "Review monthly budget",
				description: "Check expenses and adjust budget",
				dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
				status: "pending" as const,
				priority: "medium" as const,
				isRecurring: true,
				recurrenceRule: "FREQ=MONTHLY;BYMONTHDAY=1",
			},
		];

		await db.insert(tasks).values(sampleTasks);
		console.log("✅ Created sample tasks");

		// Create sample habits
		const sampleHabits = [
			{
				id: crypto.randomUUID(),
				userId: TEST_USER_ID,
				title: "Drink 8 glasses of water",
				description: "Stay hydrated throughout the day",
				frequency: "daily" as const,
				targetValue: 8,
				currentStreak: 5,
			},
			{
				id: crypto.randomUUID(),
				userId: TEST_USER_ID,
				title: "Read for 30 minutes",
				description: "Read books or articles",
				frequency: "daily" as const,
				targetValue: 1,
				currentStreak: 12,
			},
			{
				id: crypto.randomUUID(),
				userId: TEST_USER_ID,
				title: "Meditate",
				description: "Morning meditation practice",
				frequency: "daily" as const,
				targetValue: 1,
				currentStreak: 3,
			},
		];

		await db.insert(habits).values(sampleHabits);
		console.log("✅ Created sample habits");

		// Create sample habit logs
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const sampleLogs = [];
		for (let i = 0; i < 7; i++) {
			const logDate = new Date(today);
			logDate.setDate(logDate.getDate() - i);

			for (const habit of sampleHabits) {
				sampleLogs.push({
					id: crypto.randomUUID(),
					habitId: habit.id,
					date: logDate,
					value: i < 5 ? habit.targetValue : Math.floor(habit.targetValue / 2),
					status: i < 5 ? ("completed" as const) : ("partial" as const),
				});
			}
		}

		await db.insert(habitLogs).values(sampleLogs);
		console.log("✅ Created sample habit logs");

		console.log("\n🎉 Database seeded successfully!");
		console.log(`\nTest user ID: ${TEST_USER_ID}`);
		console.log(`Goals created: ${sampleGoals.length}`);
		console.log(`Tasks created: ${sampleTasks.length}`);
		console.log(`Habits created: ${sampleHabits.length}`);
		console.log(`Habit logs created: ${sampleLogs.length}`);
	} catch (error) {
		console.error("❌ Error seeding database:", error);
		throw error;
	}
}

// Run seed if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	seed()
		.then(() => {
			console.log("\n✨ Seeding complete!");
			process.exit(0);
		})
		.catch((error) => {
			console.error("\n💥 Seeding failed:", error);
			process.exit(1);
		});
}

export { seed };
