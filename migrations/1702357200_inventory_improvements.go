package migrations

import (
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/daos"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/models/schema"
)

func init() {
	m.Register(func(db dbx.Builder) error {
		dao := daos.New(db)

		// Create admin user if it doesn't exist
		_, err := dao.FindAdminByEmail("user@example.com")
		if err != nil {
			admin := &models.Admin{}
			admin.Email = "user@example.com"
			admin.SetPassword("password123")
			if err := dao.SaveAdmin(admin); err != nil {
				return err
			}
		}

		// Create test user if it doesn't exist
		users, err := dao.FindCollectionByNameOrId("users")
		if err == nil {
			_, err := dao.FindFirstRecordByData("users", "email", "user@example.com")
			if err != nil {
				record := models.NewRecord(users)
				record.Set("username", "testuser")
				record.Set("email", "user@example.com")
				record.Set("emailVisibility", true)
				record.SetPassword("password123")
				record.Set("verified", true)
				if err := dao.SaveRecord(record); err != nil {
					return err
				}
			}
		}

		// Ensure inventory collection exists
		inventory, err := dao.FindCollectionByNameOrId("inventory")
		if err != nil {
			// Create inventory collection if it doesn't exist
			inventory = &models.Collection{}
			inventory.Name = "inventory"
			inventory.Type = "base"
			inventory.ListRule = nil
			inventory.ViewRule = nil
			inventory.CreateRule = nil
			inventory.UpdateRule = nil
			inventory.DeleteRule = nil

			inventory.Schema = schema.NewSchema(
				&schema.SchemaField{
					Name:     "drug_name",
					Type:     "text",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "drug_category",
					Type:     "text",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "stock",
					Type:     "number",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "fixed_quantity",
					Type:     "number",
					Required: true,
				},
			)
		}

		// Add new fields to inventory
		inventory.Schema.AddField(&schema.SchemaField{
			Name:     "unit_size",
			Type:     "text",
			Required: true,
		})

		inventory.Schema.AddField(&schema.SchemaField{
			Name:     "dose",
			Type:     "text",
			Required: true,
		})

		// Add validation rules for inventory
		rule := "@request.auth.id != ''"
		inventory.CreateRule = &rule
		inventory.UpdateRule = &rule
		inventory.ListRule = &rule
		inventory.ViewRule = &rule

		if err := dao.SaveCollection(inventory); err != nil {
			return err
		}

		// Ensure patients collection exists
		patients, err := dao.FindCollectionByNameOrId("patients")
		if err != nil {
			// Create patients collection if it doesn't exist
			patients = &models.Collection{}
			patients.Name = "patients"
			patients.Type = "base"
			patients.ListRule = nil
			patients.ViewRule = nil
			patients.CreateRule = nil
			patients.UpdateRule = nil
			patients.DeleteRule = nil

			patients.Schema = schema.NewSchema(
				&schema.SchemaField{
					Name:     "first_name",
					Type:     "text",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "last_name",
					Type:     "text",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "dob",
					Type:     "date",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "gender",
					Type:     "text",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "age",
					Type:     "number",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "smoker",
					Type:     "text",
					Required: false,
				},
			)
		}

		// Add validation rules for patients
		authRule := "@request.auth.id != ''"
		patients.CreateRule = &authRule
		patients.UpdateRule = &authRule
		patients.ListRule = &authRule
		patients.ViewRule = &authRule

		if err := dao.SaveCollection(patients); err != nil {
			return err
		}

		// Ensure disbursements collection exists
		disbursements, err := dao.FindCollectionByNameOrId("disbursements")
		if err != nil {
			// Create disbursements collection if it doesn't exist
			disbursements = &models.Collection{}
			disbursements.Name = "disbursements"
			disbursements.Type = "base"
			disbursements.ListRule = nil
			disbursements.ViewRule = nil
			disbursements.CreateRule = nil
			disbursements.UpdateRule = nil
			disbursements.DeleteRule = nil

			maxSelect := 1
			disbursements.Schema = schema.NewSchema(
				&schema.SchemaField{
					Name: "encounter",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId: "encounters",
						MaxSelect:    &maxSelect,
					},
				},
				&schema.SchemaField{
					Name: "medication",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId: "inventory",
						MaxSelect:    &maxSelect,
					},
				},
				&schema.SchemaField{
					Name:     "quantity",
					Type:     "number",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "notes",
					Type:     "text",
					Required: false,
				},
			)
		}

		// Add validation rules for disbursements
		disbursementRule := "@request.auth.id != ''"
		disbursements.CreateRule = &disbursementRule
		disbursements.UpdateRule = &disbursementRule
		disbursements.ListRule = &disbursementRule
		disbursements.ViewRule = &disbursementRule
		disbursements.DeleteRule = &disbursementRule

		if err := dao.SaveCollection(disbursements); err != nil {
			return err
		}

		// Ensure chief_complaints collection exists
		chiefComplaints, err := dao.FindCollectionByNameOrId("chief_complaints")
		if err != nil {
			// Create chief_complaints collection if it doesn't exist
			chiefComplaints = &models.Collection{}
			chiefComplaints.Name = "chief_complaints"
			chiefComplaints.Type = "base"
			chiefComplaints.ListRule = nil
			chiefComplaints.ViewRule = nil
			chiefComplaints.CreateRule = nil
			chiefComplaints.UpdateRule = nil
			chiefComplaints.DeleteRule = nil

			chiefComplaints.Schema = schema.NewSchema(
				&schema.SchemaField{
					Name:     "name",
					Type:     "text",
					Required: true,
				},
			)
		}

		// Add validation rules for chief_complaints
		complaintRule := "@request.auth.id != ''"
		chiefComplaints.CreateRule = &complaintRule
		chiefComplaints.UpdateRule = &complaintRule
		chiefComplaints.ListRule = &complaintRule
		chiefComplaints.ViewRule = &complaintRule

		if err := dao.SaveCollection(chiefComplaints); err != nil {
			return err
		}

		// Add "OTHER" to chief complaints if it doesn't exist
		_, err = dao.FindFirstRecordByData("chief_complaints", "name", "OTHER (Custom Text Input)")
		if err != nil {
			record := models.NewRecord(chiefComplaints)
			record.Set("name", "OTHER (Custom Text Input)")
			if err := dao.SaveRecord(record); err != nil {
				return err
			}
		}

		// Remove the old "OTHER" entry if it exists
		oldOther, err := dao.FindFirstRecordByData("chief_complaints", "name", "OTHER")
		if err == nil {
			if err := dao.DeleteRecord(oldOther); err != nil {
				return err
			}
		}

		// Seed chief complaints data
		complaints := []string{
			"ABDOMINAL PAIN",
			"ANXIETY/NERVOUSNESS",
			"BACK PAIN",
			"CHEST PAIN",
			"COUGH",
			"DEPRESSION",
			"DIARRHEA",
			"DIZZINESS",
			"EARACHE",
			"FATGIUE",
			"FEVER/CHILLS/SWEATS",
			"HEADACHE",
			"JOINT PAIN",
			"NAUSEA",
			"NECK MASS",
			"NUMBNESS",
			"PALPITATIONS",
			"RASH",
			"SHORTNESS OF BREATH",
			"SOFT TISSUE INJURY",
			"SORE THROAT",
			"SWOLLEN GLANDS",
			"TENDER NECK",
			"UPPER RESPIRATORY SYMPTOMS",
			"URINARY SYMPTOMS",
			"VAGINAL DISCHARGE",
			"VOMITING",
			"VISION CHANGES",
			"OTHER (Custom Text Input)",
		}

		for _, complaint := range complaints {
			record := models.NewRecord(chiefComplaints)
			record.Set("name", complaint)
			if err := dao.SaveRecord(record); err != nil {
				return err
			}
		}

		// Ensure encounter_question_categories collection exists
		questionCategories, err := dao.FindCollectionByNameOrId("encounter_question_categories")
		if err != nil {
			questionCategories = &models.Collection{}
			questionCategories.Name = "encounter_question_categories"
			questionCategories.Type = "base"
			questionCategories.ListRule = nil
			questionCategories.ViewRule = nil
			questionCategories.CreateRule = nil
			questionCategories.UpdateRule = nil
			questionCategories.DeleteRule = nil

			questionCategories.Schema = schema.NewSchema(
				&schema.SchemaField{
					Name:     "name",
					Type:     "text",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "order",
					Type:     "number",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "type",
					Type:     "select",
					Required: true,
					Options: &schema.SelectOptions{
						Values: []string{"counter", "survey"},
					},
				},
				&schema.SchemaField{
					Name:     "archived",
					Type:     "bool",
					Required: true,
				},
			)
		}

		// Add validation rules for question categories
		categoryRule := "@request.auth.id != ''"
		questionCategories.CreateRule = &categoryRule
		questionCategories.UpdateRule = &categoryRule
		questionCategories.ListRule = &categoryRule
		questionCategories.ViewRule = &categoryRule

		if err := dao.SaveCollection(questionCategories); err != nil {
			return err
		}

		// Ensure encounter_questions collection exists
		questions, err := dao.FindCollectionByNameOrId("encounter_questions")
		if err != nil {
			questions = &models.Collection{}
			questions.Name = "encounter_questions"
			questions.Type = "base"
			questions.ListRule = nil
			questions.ViewRule = nil
			questions.CreateRule = nil
			questions.UpdateRule = nil
			questions.DeleteRule = nil

			maxSelect := 1
			questions.Schema = schema.NewSchema(
				&schema.SchemaField{
					Name:     "question_text",
					Type:     "text",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "input_type",
					Type:     "select",
					Required: true,
					Options: &schema.SelectOptions{
						Values: []string{"checkbox", "text", "select"},
					},
				},
				&schema.SchemaField{
					Name:     "description",
					Type:     "text",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "options",
					Type:     "json",
					Required: false,
					Options: &schema.JsonOptions{
						MaxSize: 2097152, // 2MB in bytes
					},
				},
				&schema.SchemaField{
					Name: "category",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId: "encounter_question_categories",
						MaxSelect:    &maxSelect,
					},
					Required: true,
				},
				&schema.SchemaField{
					Name:     "order",
					Type:     "number",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "required",
					Type:     "bool",
					Required: true,
				},
				&schema.SchemaField{
					Name: "depends_on",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId: "encounter_questions",
						MaxSelect:    &maxSelect,
					},
					Required: false,
				},
				&schema.SchemaField{
					Name:     "archived",
					Type:     "bool",
					Required: true,
				},
			)
		}

		// Add validation rules for questions
		questionRule := "@request.auth.id != ''"
		questions.CreateRule = &questionRule
		questions.UpdateRule = &questionRule
		questions.ListRule = &questionRule
		questions.ViewRule = &questionRule

		if err := dao.SaveCollection(questions); err != nil {
			return err
		}

		// Seed some initial categories
		categories := []struct {
			Name  string
			Type  string
			Order float64
		}{
			{"Standard Items", "counter", 1},
			{"Patient Satisfaction", "survey", 2},
			{"Treatment Feedback", "survey", 3},
			{"Medication Experience", "survey", 4},
		}

		for _, category := range categories {
			record := models.NewRecord(questionCategories)
			record.Set("name", category.Name)
			record.Set("type", category.Type)
			record.Set("order", category.Order)
			record.Set("archived", false)
			if err := dao.SaveRecord(record); err != nil {
				return err
			}
		}

		// Seed some initial checkbox questions for standard items
		type SeedQuestion struct {
			Text        string
			InputType   string
			Category    string
			Order       float64
			Required    bool
			Description string
			Options     []string
			DependsOn   string
		}

		// Standard Items (Counter category)
		standardItems := []SeedQuestion{
			{
				Text:      "Sunglasses",
				InputType: "checkbox",
				Category:  "Standard Items",
				Order:     1,
				Required:  false,
			},
			{
				Text:      "Water Bottle",
				InputType: "checkbox",
				Category:  "Standard Items",
				Order:     2,
				Required:  false,
			},
			{
				Text:      "Information Packet",
				InputType: "checkbox",
				Category:  "Standard Items",
				Order:     3,
				Required:  false,
			},
		}

		// Patient Satisfaction (Survey category)
		satisfactionQuestions := []SeedQuestion{
			{
				Text:        "How would you rate your overall experience?",
				InputType:   "select",
				Category:    "Patient Satisfaction",
				Order:       1,
				Required:    true,
				Description: "Please rate your experience from 1 to 5",
				Options:     []string{"1 - Poor", "2 - Fair", "3 - Good", "4 - Very Good", "5 - Excellent"},
			},
			{
				Text:      "Would you recommend our clinic to others?",
				InputType: "select",
				Category:  "Patient Satisfaction",
				Order:     2,
				Required:  true,
				Options:   []string{"Yes", "No", "Maybe"},
			},
			{
				Text:        "What could we improve?",
				InputType:   "text",
				Category:    "Patient Satisfaction",
				Order:       3,
				Required:    false,
				Description: "Please share any suggestions for improvement",
			},
		}

		// Treatment Feedback (Survey category)
		treatmentQuestions := []SeedQuestion{
			{
				Text:      "Did the provider explain your treatment clearly?",
				InputType: "select",
				Category:  "Treatment Feedback",
				Order:     1,
				Required:  true,
				Options:   []string{"Yes, very clearly", "Somewhat clearly", "No, not clearly"},
			},
			{
				Text:      "Do you have any questions about your medications?",
				InputType: "checkbox",
				Category:  "Treatment Feedback",
				Order:     2,
				Required:  true,
			},
			{
				Text:        "What questions do you have?",
				InputType:   "text",
				Category:    "Treatment Feedback",
				Order:       3,
				Required:    false,
				Description: "Please list your questions about medications",
				DependsOn:   "Do you have any questions about your medications?",
			},
		}

		// Medication Experience (Survey category)
		medicationQuestions := []SeedQuestion{
			{
				Text:      "Have you had any previous reactions to medications?",
				InputType: "checkbox",
				Category:  "Medication Experience",
				Order:     1,
				Required:  true,
			},
			{
				Text:      "Please describe any previous reactions:",
				InputType: "text",
				Category:  "Medication Experience",
				Order:     2,
				Required:  false,
				DependsOn: "Have you had any previous reactions to medications?",
			},
			{
				Text:      "How do you prefer to receive medication instructions?",
				InputType: "select",
				Category:  "Medication Experience",
				Order:     3,
				Required:  true,
				Options:   []string{"Written", "Verbal", "Both"},
			},
		}

		// Function to save questions and handle dependencies
		saveSeedQuestions := func(seedQuestions []SeedQuestion, dao *daos.Dao) error {
			// Map to store question IDs for dependency linking
			questionIds := make(map[string]string)

			// Get the questions collection
			questionsCollection, err := dao.FindCollectionByNameOrId("encounter_questions")
			if err != nil {
				return err
			}

			for _, q := range seedQuestions {
				// Find category
				category, err := dao.FindFirstRecordByData("encounter_question_categories", "name", q.Category)
				if err != nil {
					continue
				}

				// Create question record
				record := models.NewRecord(questionsCollection)
				record.Set("question_text", q.Text)
				record.Set("input_type", q.InputType)
				record.Set("category", category.Id)
				record.Set("order", q.Order)
				record.Set("required", q.Required)
				record.Set("description", q.Description)
				record.Set("archived", false)

				if len(q.Options) > 0 {
					record.Set("options", q.Options)
				}

				if err := dao.SaveRecord(record); err != nil {
					return err
				}

				// Store question ID for dependency linking
				questionIds[q.Text] = record.Id
			}

			// Second pass to set up dependencies
			for _, q := range seedQuestions {
				if q.DependsOn != "" {
					if dependsOnId, ok := questionIds[q.DependsOn]; ok {
						// Find the question we just created
						question, err := dao.FindFirstRecordByData("encounter_questions", "question_text", q.Text)
						if err != nil {
							continue
						}

						// Update with dependency
						question.Set("depends_on", dependsOnId)
						if err := dao.SaveRecord(question); err != nil {
							return err
						}
					}
				}
			}

			return nil
		}

		// Save all seed questions
		allQuestions := append(standardItems, satisfactionQuestions...)
		allQuestions = append(allQuestions, treatmentQuestions...)
		allQuestions = append(allQuestions, medicationQuestions...)
		if err := saveSeedQuestions(allQuestions, dao); err != nil {
			return err
		}

		// Create encounter_responses collection
		maxSelect := 1
		defaultRule := "@request.auth.id != ''"

		responses := &models.Collection{
			Name: "encounter_responses",
			Type: "base",
			Schema: schema.NewSchema(
				&schema.SchemaField{
					Name: "encounter",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId: "encounters",
						MaxSelect:    &maxSelect,
					},
					Required: true,
				},
				&schema.SchemaField{
					Name: "question",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId: "encounter_questions",
						MaxSelect:    &maxSelect,
					},
					Required: true,
				},
				&schema.SchemaField{
					Name:     "response_value",
					Type:     "json",
					Required: true,
					Options: &schema.JsonOptions{
						MaxSize: 2097152, // 2MB in bytes
					},
				},
			),
			CreateRule: &defaultRule,
			UpdateRule: &defaultRule,
			DeleteRule: &defaultRule,
			ListRule:   &defaultRule,
			ViewRule:   &defaultRule,
		}

		if err := dao.SaveCollection(responses); err != nil {
			return err
		}

		// Create bulk_distributions collection
		bulkDistributions := &models.Collection{
			Name: "bulk_distributions",
			Type: "base",
			Schema: schema.NewSchema(
				&schema.SchemaField{
					Name:     "date",
					Type:     "date",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "notes",
					Type:     "text",
					Required: false,
				},
			),
		}

		// Set validation rules
		bulkRule := "@request.auth.id != ''"
		bulkDistributions.ListRule = &bulkRule
		bulkDistributions.ViewRule = &bulkRule
		bulkDistributions.CreateRule = &bulkRule
		bulkDistributions.UpdateRule = &bulkRule
		bulkDistributions.DeleteRule = &bulkRule

		if err := dao.SaveCollection(bulkDistributions); err != nil {
			return err
		}

		// Create bulk_distribution_items collection
		maxSelect = 1
		bulkItems := &models.Collection{
			Name: "bulk_distribution_items",
			Type: "base",
			Schema: schema.NewSchema(
				&schema.SchemaField{
					Name: "distribution",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId: "bulk_distributions",
						MaxSelect:    &maxSelect,
					},
					Required: true,
				},
				&schema.SchemaField{
					Name: "question",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId: "encounter_questions",
						MaxSelect:    &maxSelect,
					},
					Required: true,
				},
				&schema.SchemaField{
					Name:     "quantity",
					Type:     "number",
					Required: true,
					Options: &schema.NumberOptions{
						Min: float64Ptr(0),
					},
				},
			),
		}

		// Set validation rules
		bulkItems.ListRule = &bulkRule
		bulkItems.ViewRule = &bulkRule
		bulkItems.CreateRule = &bulkRule
		bulkItems.UpdateRule = &bulkRule
		bulkItems.DeleteRule = &bulkRule

		if err := dao.SaveCollection(bulkItems); err != nil {
			return err
		}

		// Ensure encounters collection exists
		encounters, err := dao.FindCollectionByNameOrId("encounters")
		if err != nil {
			// Create encounters collection if it doesn't exist
			encounters = &models.Collection{}
			encounters.Name = "encounters"
			encounters.Type = "base"
			encounters.ListRule = nil
			encounters.ViewRule = nil
			encounters.CreateRule = nil
			encounters.UpdateRule = nil
			encounters.DeleteRule = nil

			encounters.Schema = schema.NewSchema(
				&schema.SchemaField{
					Name: "patient",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId:  "patients",
						CascadeDelete: false,
						MaxSelect:     &[]int{1}[0],
					},
					Required: false,
				},
				&schema.SchemaField{
					Name:     "height_inches",
					Type:     "number",
					Required: false,
					Options: &schema.NumberOptions{
						NoDecimal: true,
					},
				},
				&schema.SchemaField{
					Name:     "weight",
					Type:     "number",
					Required: false,
					Options: &schema.NumberOptions{
						NoDecimal: false,
					},
				},
				&schema.SchemaField{
					Name:     "temperature",
					Type:     "number",
					Required: false,
					Options: &schema.NumberOptions{
						NoDecimal: false,
					},
				},
				&schema.SchemaField{
					Name:     "heart_rate",
					Type:     "number",
					Required: false,
					Options: &schema.NumberOptions{
						NoDecimal: true,
					},
				},
				&schema.SchemaField{
					Name:     "systolic_pressure",
					Type:     "number",
					Required: false,
					Options: &schema.NumberOptions{
						NoDecimal: true,
					},
				},
				&schema.SchemaField{
					Name:     "diastolic_pressure",
					Type:     "number",
					Required: false,
					Options: &schema.NumberOptions{
						NoDecimal: true,
					},
				},
				&schema.SchemaField{
					Name:     "chief_complaint",
					Type:     "relation",
					Required: false,
					Options: &schema.RelationOptions{
						CollectionId: "chief_complaints",
						MaxSelect:    &maxSelect,
					},
				},
				&schema.SchemaField{
					Name:     "other_chief_complaint",
					Type:     "text",
					Required: false,
				},
			)
		}

		// Add validation rules for encounters
		encounters.CreateRule = &authRule
		encounters.UpdateRule = &authRule
		encounters.ListRule = &authRule
		encounters.ViewRule = &authRule

		if err := dao.SaveCollection(encounters); err != nil {
			return err
		}

		// Create queue collection
		queueCollection, err := dao.FindCollectionByNameOrId("queue")
		if err != nil {
			// Create queue collection if it doesn't exist
			queueCollection = &models.Collection{}
			queueCollection.Name = "queue"
			queueCollection.Type = "base"

			queueCollection.Schema = schema.NewSchema(
				&schema.SchemaField{
					Name:     "patient",
					Type:     "relation",
					Required: true,
					Options: &schema.RelationOptions{
						CollectionId: "patients",
						MinSelect:    nil,
						MaxSelect:    &[]int{1}[0],
					},
				},
				&schema.SchemaField{
					Name:     "status",
					Type:     "select",
					Required: true,
					Options: &schema.SelectOptions{
						MaxSelect: 1,
						Values: []string{
							"checked_in",     // Initial state when patient arrives
							"with_care_team", // Assigned to and being seen by care team
							"ready_pharmacy", // Care team finished, waiting for pharmacy
							"with_pharmacy",  // Currently being handled by pharmacy
							"completed",      // Checked out after receiving medications
						},
					},
				},
				&schema.SchemaField{
					Name:     "line_number",
					Type:     "number",
					Required: false,
					Options: &schema.NumberOptions{
						Min: float64Ptr(1),
					},
				},
				&schema.SchemaField{
					Name:     "assigned_to",
					Type:     "relation",
					Required: false,
					Options: &schema.RelationOptions{
						CollectionId: "users",
						MinSelect:    nil,
						MaxSelect:    &[]int{1}[0],
					},
				},
				&schema.SchemaField{
					Name:     "check_in_time",
					Type:     "date",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "start_time",
					Type:     "date",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "end_time",
					Type:     "date",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "priority",
					Type:     "number",
					Required: true,
					Options: &schema.NumberOptions{
						Min: float64Ptr(1.0),
						Max: float64Ptr(5.0),
					},
				},
				&schema.SchemaField{
					Name:     "encounter",
					Type:     "relation",
					Required: false,
					Options: &schema.RelationOptions{
						CollectionId: "encounters",
						MaxSelect:    &[]int{1}[0],
					},
				},
			)

			// Set validation rules
			queueRule := "@request.auth.id != ''"
			queueCollection.ListRule = &queueRule
			queueCollection.ViewRule = &queueRule
			queueCollection.CreateRule = &queueRule
			queueCollection.UpdateRule = &queueRule
			queueCollection.DeleteRule = &queueRule

			// First save the collection to create the table
			if err := dao.SaveCollection(queueCollection); err != nil {
				return err
			}

			// Create trigger for auto-incrementing line_number
			_, err = db.NewQuery(`
				CREATE TRIGGER IF NOT EXISTS tr_queue_line_number
				AFTER INSERT ON queue
				BEGIN
					UPDATE queue 
					SET line_number = (
						SELECT COALESCE(MAX(line_number), 0) + 1 
						FROM queue 
						WHERE strftime('%Y-%m-%d', created) = strftime('%Y-%m-%d', NEW.created)
					)
					WHERE id = NEW.id AND NEW.line_number IS NULL;
				END;
			`).Execute()

			if err != nil {
				return err
			}
		} else {
			// Update existing collection with new rules
			queueRule := "@request.auth.id != ''"
			queueCollection.ListRule = &queueRule
			queueCollection.ViewRule = &queueRule
			queueCollection.CreateRule = &queueRule
			queueCollection.UpdateRule = &queueRule
			queueCollection.DeleteRule = &queueRule

			if err := dao.SaveCollection(queueCollection); err != nil {
				return err
			}
		}

		// Seed inventory data
		inventoryItems := []struct {
			DrugName     string  `json:"drug_name"`
			DrugCategory string  `json:"drug_category"`
			Stock        float64 `json:"stock"`
			FixedQty     float64 `json:"fixed_quantity"`
			UnitSize     string  `json:"unit_size"`
			Dose         string  `json:"dose"`
		}{
			{
				DrugName:     "Acetaminophen",
				DrugCategory: "Pain Relief",
				Stock:        100,
				FixedQty:     30,
				UnitSize:     "30ct",
				Dose:         "500mg",
			},
			{
				DrugName:     "Ibuprofen",
				DrugCategory: "Pain Relief",
				Stock:        150,
				FixedQty:     30,
				UnitSize:     "30ct",
				Dose:         "200mg",
			},
			{
				DrugName:     "Amoxicillin",
				DrugCategory: "Antibiotic",
				Stock:        50,
				FixedQty:     20,
				UnitSize:     "20ct",
				Dose:         "500mg",
			},
			{
				DrugName:     "Lisinopril",
				DrugCategory: "Blood Pressure",
				Stock:        75,
				FixedQty:     30,
				UnitSize:     "30ct",
				Dose:         "10mg",
			},
			{
				DrugName:     "Metformin",
				DrugCategory: "Diabetes",
				Stock:        60,
				FixedQty:     30,
				UnitSize:     "30ct",
				Dose:         "500mg",
			},
			{
				DrugName:     "Albuterol",
				DrugCategory: "Respiratory",
				Stock:        40,
				FixedQty:     1,
				UnitSize:     "1 inhaler",
				Dose:         "90mcg",
			},
		}

		for _, item := range inventoryItems {
			record := models.NewRecord(inventory)
			record.Set("drug_name", item.DrugName)
			record.Set("drug_category", item.DrugCategory)
			record.Set("stock", item.Stock)
			record.Set("fixed_quantity", item.FixedQty)
			record.Set("unit_size", item.UnitSize)
			record.Set("dose", item.Dose)

			if err := dao.SaveRecord(record); err != nil {
				return err
			}
		}

		// Update users collection to add role field
		users, err = dao.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		// Add role field if it doesn't exist
		roleField := users.Schema.GetFieldByName("role")
		if roleField == nil {
			users.Schema.AddField(&schema.SchemaField{
				Name:     "role",
				Type:     schema.FieldTypeSelect,
				Required: true,
				Options: &schema.SelectOptions{
					Values:    []string{"provider", "pharmacy", "admin"},
					MaxSelect: 1,
				},
			})
		}

		return dao.SaveCollection(users)
	}, func(db dbx.Builder) error {
		dao := daos.New(db)

		// Revert inventory collection changes
		inventory, err := dao.FindCollectionByNameOrId("inventory")
		if err != nil {
			return err
		}

		inventory.Schema.RemoveField("unit_size")
		inventory.Schema.RemoveField("dose")

		defaultRule := "@request.auth.id != ''"
		inventory.CreateRule = &defaultRule
		inventory.UpdateRule = &defaultRule

		if err := dao.SaveCollection(inventory); err != nil {
			return err
		}

		// Revert disbursements collection changes
		disbursements, err := dao.FindCollectionByNameOrId("disbursements")
		if err != nil {
			return err
		}

		disbursements.CreateRule = &defaultRule
		disbursements.UpdateRule = &defaultRule

		if err := dao.SaveCollection(disbursements); err != nil {
			return err
		}

		// Revert encounters collection changes
		encounters, err := dao.FindCollectionByNameOrId("encounters")
		if err != nil {
			return err
		}

		encounters.CreateRule = &defaultRule
		encounters.UpdateRule = &defaultRule

		if err := dao.SaveCollection(encounters); err != nil {
			return err
		}

		// Revert queue collection changes
		queueCollection, err := dao.FindCollectionByNameOrId("queue")
		if err != nil {
			return err
		}

		queueCollection.DeleteRule = &defaultRule
		queueCollection.CreateRule = &defaultRule
		queueCollection.UpdateRule = &defaultRule
		queueCollection.ListRule = &defaultRule
		queueCollection.ViewRule = &defaultRule

		if err := dao.SaveCollection(queueCollection); err != nil {
			return err
		}

		// Revert chief_complaints collection changes
		chiefComplaints, err := dao.FindCollectionByNameOrId("chief_complaints")
		if err != nil {
			return err
		}

		chiefComplaints.CreateRule = &defaultRule
		chiefComplaints.UpdateRule = &defaultRule
		chiefComplaints.ListRule = &defaultRule
		chiefComplaints.ViewRule = &defaultRule

		if err := dao.SaveCollection(chiefComplaints); err != nil {
			return err
		}

		// Revert encounter_question_categories collection changes
		questionCategories, err := dao.FindCollectionByNameOrId("encounter_question_categories")
		if err != nil {
			return err
		}

		questionCategories.CreateRule = &defaultRule
		questionCategories.UpdateRule = &defaultRule
		questionCategories.ListRule = &defaultRule
		questionCategories.ViewRule = &defaultRule

		if err := dao.SaveCollection(questionCategories); err != nil {
			return err
		}

		// Revert encounter_questions collection changes
		questions, err := dao.FindCollectionByNameOrId("encounter_questions")
		if err != nil {
			return err
		}

		questions.CreateRule = &defaultRule
		questions.UpdateRule = &defaultRule
		questions.ListRule = &defaultRule
		questions.ViewRule = &defaultRule

		if err := dao.SaveCollection(questions); err != nil {
			return err
		}

		// Revert encounter_responses collection changes
		responses, err := dao.FindCollectionByNameOrId("encounter_responses")
		if err != nil {
			return err
		}

		responses.CreateRule = &defaultRule
		responses.UpdateRule = &defaultRule
		responses.ListRule = &defaultRule
		responses.ViewRule = &defaultRule

		if err := dao.SaveCollection(responses); err != nil {
			return err
		}

		return nil
	})
}

func float64Ptr(v float64) *float64 {
	return &v
}
