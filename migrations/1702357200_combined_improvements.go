package migrations

import (
	"fmt"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/daos"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/models/schema"
	"github.com/pocketbase/pocketbase/tools/types"
)

type SeedQuestion struct {
	QuestionText string
	InputType    string
	Description  string
	Options      []string
	Order        int
	Required     bool
	DependsOn    string
}

func seedQuestions(dao *daos.Dao, categoryId string, questions []SeedQuestion) error {
	collection, err := dao.FindCollectionByNameOrId("encounter_questions")
	if err != nil {
		return err
	}

	for _, q := range questions {
		// Check if question already exists
		existingQuestion, err := dao.FindFirstRecordByData("encounter_questions", "question_text", q.QuestionText)
		if err == nil && existingQuestion != nil {
			// Update existing question
			existingQuestion.Set("input_type", q.InputType)
			existingQuestion.Set("description", q.Description)
			existingQuestion.Set("options", q.Options)
			existingQuestion.Set("order", q.Order)
			existingQuestion.Set("required", q.Required)
			existingQuestion.Set("depends_on", q.DependsOn)
			existingQuestion.Set("category", categoryId)
			if err := dao.SaveRecord(existingQuestion); err != nil {
				return err
			}
			continue
		}

		// Create new question
		record := models.NewRecord(collection)
		record.Set("question_text", q.QuestionText)
		record.Set("input_type", q.InputType)
		record.Set("description", q.Description)
		record.Set("options", q.Options)
		record.Set("order", q.Order)
		record.Set("required", q.Required)
		record.Set("depends_on", q.DependsOn)
		record.Set("category", categoryId)
		if err := dao.SaveRecord(record); err != nil {
			return err
		}
	}
	return nil
}

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

		// Get users collection and add role field first
		users, err := dao.FindCollectionByNameOrId("users")
		if err == nil {
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
				if err := dao.SaveCollection(users); err != nil {
					return err
				}
			}

			// Create provider user
			_, err := dao.FindFirstRecordByData("users", "email", "provider@example.com")
			if err != nil {
				record := models.NewRecord(users)
				record.Set("username", "provider")
				record.Set("email", "provider@example.com")
				record.Set("emailVisibility", true)
				record.Set("role", "provider")
				record.SetPassword("password123")
				record.Set("verified", true)
				if err := dao.SaveRecord(record); err != nil {
					return err
				}
			}

			// Create additional provider users (provider2-6)
			for i := 2; i <= 6; i++ {
				email := fmt.Sprintf("provider%d@example.com", i)
				_, err := dao.FindFirstRecordByData("users", "email", email)
				if err != nil {
					record := models.NewRecord(users)
					record.Set("username", fmt.Sprintf("provider%d", i))
					record.Set("email", email)
					record.Set("emailVisibility", true)
					record.Set("role", "provider")
					record.SetPassword("password123")
					record.Set("verified", true)
					if err := dao.SaveRecord(record); err != nil {
						return err
					}
				}
			}

			// Create pharmacy user
			_, err = dao.FindFirstRecordByData("users", "email", "pharmacyuser@example.com")
			if err != nil {
				record := models.NewRecord(users)
				record.Set("username", "pharmacyuser")
				record.Set("email", "pharmacyuser@example.com")
				record.Set("emailVisibility", true)
				record.Set("role", "pharmacy")
				record.SetPassword("password123")
				record.Set("verified", true)
				if err := dao.SaveRecord(record); err != nil {
					return err
				}
			}

			// Create additional pharmacy users (pharmacyuser2-4)
			for i := 2; i <= 4; i++ {
				email := fmt.Sprintf("pharmacyuser%d@example.com", i)
				_, err := dao.FindFirstRecordByData("users", "email", email)
				if err != nil {
					record := models.NewRecord(users)
					record.Set("username", fmt.Sprintf("pharmacyuser%d", i))
					record.Set("email", email)
					record.Set("emailVisibility", true)
					record.Set("role", "pharmacy")
					record.SetPassword("password123")
					record.Set("verified", true)
					if err := dao.SaveRecord(record); err != nil {
						return err
					}
				}
			}

			// Create admin user
			_, err = dao.FindFirstRecordByData("users", "email", "admin@example.com")
			if err != nil {
				record := models.NewRecord(users)
				record.Set("username", "admin")
				record.Set("email", "admin@example.com")
				record.Set("emailVisibility", true)
				record.Set("role", "admin")
				record.SetPassword("password123")
				record.Set("verified", true)
				if err := dao.SaveRecord(record); err != nil {
					return err
				}
			}
		}

		// Create settings collection
		settings := &models.Collection{
			Name: "settings",
			Type: "base",
			Schema: schema.NewSchema(
				&schema.SchemaField{
					Name:     "unit_display",
					Type:     "json",
					Required: true,
					Options: &schema.JsonOptions{
						MaxSize: 2097152, // 2MB
					},
				},
				&schema.SchemaField{
					Name:     "display_preferences",
					Type:     "json",
					Required: true,
					Options: &schema.JsonOptions{
						MaxSize: 2097152, // 2MB
					},
				},
				&schema.SchemaField{
					Name:     "last_updated",
					Type:     "date",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "updated_by",
					Type:     "relation",
					Required: true,
					Options: &schema.RelationOptions{
						CollectionId: "users",
						MaxSelect:    types.Pointer(1),
					},
				},
			),
		}

		// Set admin-only rules for settings
		createRule := "@request.auth.role = 'admin'"
		updateRule := "@request.auth.role = 'admin'"
		viewRule := "@request.auth.id != ''"
		settings.CreateRule = &createRule
		settings.UpdateRule = &updateRule
		settings.ViewRule = &viewRule
		settings.ListRule = &viewRule

		if err := dao.SaveCollection(settings); err != nil {
			return err
		}

		// Create default settings record
		defaultSettings := models.NewRecord(settings)
		defaultSettings.Set("unit_display", map[string]interface{}{
			"height":      "cm",
			"weight":      "kg",
			"temperature": "F",
		})
		defaultSettings.Set("display_preferences", map[string]interface{}{
			"show_priority_dropdown":    false,
			"show_care_team_assignment": false,
			"care_team_count":           6,
			"show_gyn_team":             false,
			"show_optometry_team":       false,
		})
		defaultSettings.Set("last_updated", time.Now().Format("2006-01-02 15:04:05.000Z"))

		// Find admin user to set as updated_by
		adminUser, err := dao.FindFirstRecordByData("users", "email", "admin@example.com")
		if err == nil {
			defaultSettings.Set("updated_by", adminUser.Id)
			if err := dao.SaveRecord(defaultSettings); err != nil {
				return err
			}
		}

		// Create inventory collection
		inventory := &models.Collection{
			Name: "inventory",
			Type: "base",
			Schema: schema.NewSchema(
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
				&schema.SchemaField{
					Name:     "unit_size",
					Type:     "text",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "dose",
					Type:     "text",
					Required: false,
				},
			),
		}

		// Create patients collection
		patients := &models.Collection{
			Name:       "patients",
			Type:       "base",
			ListRule:   types.Pointer(""),                                                                // Anyone can view
			ViewRule:   types.Pointer(""),                                                                // Anyone can view
			CreateRule: types.Pointer(""),                                                                // Anyone can create
			UpdateRule: types.Pointer(""),                                                                // Anyone can update
			DeleteRule: types.Pointer("@request.auth.role = 'provider' || @request.auth.role = 'admin'"), // Only providers and admins can delete
			Schema: schema.NewSchema(
				&schema.SchemaField{
					Name:     "first_name",
					Type:     "text",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "last_name",
					Type:     "text",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "dob",
					Type:     "date",
					Required: false,
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
				&schema.SchemaField{
					Name:     "allergies",
					Type:     "text",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "pregnancy_status",
					Type:     "select",
					Required: false,
					Options: &schema.SelectOptions{
						MaxSelect: 1,
						Values: []string{
							"yes",
							"no",
							"potentially",
						},
					},
				},
			),
		}

		// Create encounters collection
		encounters := &models.Collection{
			Name: "encounters",
			Type: "base",
			Schema: schema.NewSchema(
				&schema.SchemaField{
					Name: "patient",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId:  "patients",
						CascadeDelete: false,
						MaxSelect:     types.Pointer(1),
					},
					Required: false,
				},
				&schema.SchemaField{
					Name:     "height",
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
					Name:     "pulse_ox",
					Type:     "number",
					Required: false,
					Options: &schema.NumberOptions{
						NoDecimal: true,
					},
				},
				&schema.SchemaField{
					Name:     "past_medical_history",
					Type:     "text",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "chief_complaint",
					Type:     "relation",
					Required: false,
					Options: &schema.RelationOptions{
						CollectionId: "chief_complaints",
						MaxSelect:    nil, // Changed to nil to allow multiple selections
					},
				},
				&schema.SchemaField{
					Name:     "diagnosis",
					Type:     "relation",
					Required: false,
					Options: &schema.RelationOptions{
						CollectionId: "diagnosis",
						MaxSelect:    nil, // Allow multiple selections
					},
				},
				&schema.SchemaField{
					Name:     "other_chief_complaint",
					Type:     "text",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "other_diagnosis",
					Type:     "text",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "subjective_notes",
					Type:     "text",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "urinalysis",
					Type:     "bool",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "blood_sugar",
					Type:     "bool",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "pregnancy_test",
					Type:     "bool",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "urinalysis_result",
					Type:     "text",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "blood_sugar_result",
					Type:     "text",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "pregnancy_test_result",
					Type:     "text",
					Required: false,
				},
			),
		}

		// Create disbursements collection
		disbursements := &models.Collection{
			Name: "disbursements",
			Type: "base",
			Schema: schema.NewSchema(
				&schema.SchemaField{
					Name: "encounter",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId: "encounters",
						MaxSelect:    types.Pointer(1),
					},
				},
				&schema.SchemaField{
					Name: "medication",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId: "inventory",
						MaxSelect:    types.Pointer(1),
					},
				},
				&schema.SchemaField{
					Name:     "quantity",
					Type:     "number",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "frequency",
					Type:     "select",
					Required: false,
					Options: &schema.SelectOptions{
						MaxSelect: 1,
						Values: []string{
							"QD",
							"BID",
							"TID",
							"QID",
							"QHS",
							"QAM",
							"QPM",
							"PRN",
							"Q#H",
							"STAT",
						},
					},
				},
				&schema.SchemaField{
					Name:     "frequency_hours",
					Type:     "number",
					Required: false,
					Options: &schema.NumberOptions{
						Min: types.Pointer(1.0),
						Max: types.Pointer(24.0),
					},
				},
				&schema.SchemaField{
					Name: "associated_diagnosis",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId: "diagnosis",
						MaxSelect:    types.Pointer(1),
					},
					Required: false,
				},
				&schema.SchemaField{
					Name:     "notes",
					Type:     "text",
					Required: false,
				},
			),
		}

		// Create chief_complaints collection
		chiefComplaints := &models.Collection{
			Name: "chief_complaints",
			Type: "base",
			Schema: schema.NewSchema(
				&schema.SchemaField{
					Name:     "name",
					Type:     "text",
					Required: true,
				},
			),
		}

		// Create encounter_question_categories collection
		questionCategories := &models.Collection{
			Name: "encounter_question_categories",
			Type: "base",
			Schema: schema.NewSchema(
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
			),
		}

		// Create encounter_questions collection
		questions := &models.Collection{
			Name: "encounter_questions",
			Type: "base",
			Schema: schema.NewSchema(
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
						Values:    []string{"checkbox", "text", "select"},
						MaxSelect: 1,
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
						MaxSelect:    types.Pointer(1),
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
					Required: false,
				},
				&schema.SchemaField{
					Name: "depends_on",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId: "encounter_questions",
						MaxSelect:    types.Pointer(1),
					},
					Required: false,
				},
				&schema.SchemaField{
					Name:     "archived",
					Type:     "bool",
					Required: false,
				},
			),
		}

		// Create encounter_responses collection
		responses := &models.Collection{
			Name: "encounter_responses",
			Type: "base",
			Schema: schema.NewSchema(
				&schema.SchemaField{
					Name: "encounter",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId: "encounters",
						MaxSelect:    types.Pointer(1),
					},
					Required: true,
				},
				&schema.SchemaField{
					Name: "question",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId: "encounter_questions",
						MaxSelect:    types.Pointer(1),
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

		// Create bulk_distribution_items collection
		bulkItems := &models.Collection{
			Name: "bulk_distribution_items",
			Type: "base",
			Schema: schema.NewSchema(
				&schema.SchemaField{
					Name: "distribution",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId: "bulk_distributions",
						MaxSelect:    types.Pointer(1),
					},
					Required: true,
				},
				&schema.SchemaField{
					Name: "question",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId: "encounter_questions",
						MaxSelect:    types.Pointer(1),
					},
					Required: true,
				},
				&schema.SchemaField{
					Name:     "quantity",
					Type:     "number",
					Required: true,
					Options: &schema.NumberOptions{
						Min: types.Pointer(0.0),
					},
				},
			),
		}

		// Create queue collection
		queue := &models.Collection{
			Name: "queue",
			Type: "base",
			Schema: schema.NewSchema(
				&schema.SchemaField{
					Name:     "patient",
					Type:     "relation",
					Required: true,
					Options: &schema.RelationOptions{
						CollectionId: "patients",
						MinSelect:    nil,
						MaxSelect:    types.Pointer(1),
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
							"at_checkout",    // At checkout desk for standard items
							"completed",      // Checked out after receiving medications
						},
					},
				},
				&schema.SchemaField{
					Name:     "line_number",
					Type:     "number",
					Required: true,
					Options: &schema.NumberOptions{
						Min: types.Pointer(1.0),
					},
				},
				&schema.SchemaField{
					Name:     "assigned_to",
					Type:     "relation",
					Required: false,
					Options: &schema.RelationOptions{
						CollectionId: "users",
						MinSelect:    nil,
						MaxSelect:    types.Pointer(1),
					},
				},
				&schema.SchemaField{
					Name:     "intended_provider",
					Type:     "select",
					Required: false,
					Options: &schema.SelectOptions{
						MaxSelect: 1,
						Values: []string{
							"team1",
							"team2",
							"team3",
							"team4",
							"team5",
							"team6",
							"team7",
							"team8",
							"team9",
							"team10",
							"gyn_team",
							"optometry_team",
						},
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
						Min: types.Pointer(1.0),
						Max: types.Pointer(5.0),
					},
				},
				&schema.SchemaField{
					Name:     "encounter",
					Type:     "relation",
					Required: false,
					Options: &schema.RelationOptions{
						CollectionId: "encounters",
						MaxSelect:    types.Pointer(1),
					},
				},
			),
		}

		// Create diagnosis collection
		diagnosis := &models.Collection{
			Name: "diagnosis",
			Type: "base",
			Schema: schema.NewSchema(
				&schema.SchemaField{
					Name:     "name",
					Type:     "text",
					Required: true,
				},
			),
		}

		// Save patients collection with its own rules
		if err := dao.SaveCollection(patients); err != nil {
			return err
		}

		// Set rules for other collections
		authRule := "@request.auth.id != ''"
		adminRule := "@request.auth.role = 'admin'"
		providerRule := "@request.auth.role = 'provider'"
		pharmacyRule := "@request.auth.role = 'pharmacy'"

		// Base rule that allows admin access to everything, plus role-specific access
		baseRule := fmt.Sprintf("%s || %s", adminRule, authRule)
		deleteRule := fmt.Sprintf("%s || %s", adminRule, providerRule)
		pharmacyDeleteRule := fmt.Sprintf("%s || %s || %s", adminRule, providerRule, pharmacyRule)

		collections := []*models.Collection{
			inventory, encounters, chiefComplaints, questionCategories, questions,
			responses, bulkDistributions, bulkItems, queue, diagnosis,
		}

		for _, c := range collections {
			c.CreateRule = &baseRule
			c.UpdateRule = &baseRule
			c.DeleteRule = &deleteRule
			c.ListRule = &baseRule
			c.ViewRule = &baseRule

			if err := dao.SaveCollection(c); err != nil {
				return err
			}
		}

		// Set special delete rule for disbursements to allow pharmacy role
		disbursements.CreateRule = &baseRule
		disbursements.UpdateRule = &baseRule
		disbursements.DeleteRule = &pharmacyDeleteRule
		disbursements.ListRule = &baseRule
		disbursements.ViewRule = &baseRule

		if err := dao.SaveCollection(disbursements); err != nil {
			return err
		}

		// Create queue line number trigger
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

		// Seed chief complaints data
		complaints := []string{
			"ABDOMINAL PAIN", "ANXIETY/NERVOUSNESS", "BACK PAIN",
			"CHEST PAIN", "COUGH", "DEPRESSION", "DIARRHEA",
			"DIZZINESS", "EARACHE", "FATGIUE", "FEVER/CHILLS/SWEATS",
			"HEADACHE", "JOINT PAIN", "NAUSEA", "NECK MASS",
			"NUMBNESS", "PALPITATIONS", "RASH", "SHORTNESS OF BREATH",
			"SOFT TISSUE INJURY", "SORE THROAT", "SWOLLEN GLANDS",
			"TENDER NECK", "UPPER RESPIRATORY SYMPTOMS", "URINARY SYMPTOMS",
			"VAGINAL DISCHARGE", "VOMITING", "VISION CHANGES",
			"OTHER (Custom Text Input)",
		}

		for _, complaint := range complaints {
			record := models.NewRecord(chiefComplaints)
			record.Set("name", complaint)
			if err := dao.SaveRecord(record); err != nil {
				return err
			}
		}

		// Seed categories
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

		// Seed standard items
		standardItems := []struct {
			Text  string
			Order float64
		}{
			{"Goodie Bag", 1},
			{"Fluoride", 2},
			{"Sunglasses", 3},
			{"Reading Glasses", 4},
			{"Hat", 5},
			{"Information Packet", 6},
			{"Water Bottle", 7},
		}

		standardCategory, err := dao.FindFirstRecordByData("encounter_question_categories", "name", "Standard Items")
		if err != nil {
			return err
		}

		for _, item := range standardItems {
			question := models.NewRecord(questions)
			question.Set("question_text", item.Text)
			question.Set("input_type", "checkbox")
			question.Set("category", standardCategory.Id)
			question.Set("order", item.Order)
			question.Set("required", false)
			question.Set("archived", false)
			if err := dao.SaveRecord(question); err != nil {
				return err
			}
		}

		// Seed survey questions
		surveyCategory, err := dao.FindFirstRecordByData("encounter_question_categories", "name", "Patient Satisfaction")
		if err != nil {
			return err
		}

		treatmentCategory, err := dao.FindFirstRecordByData("encounter_question_categories", "name", "Treatment Feedback")
		if err != nil {
			return err
		}

		medicationCategory, err := dao.FindFirstRecordByData("encounter_question_categories", "name", "Medication Experience")
		if err != nil {
			return err
		}

		// Patient Satisfaction Questions
		satisfactionQuestions := []struct {
			Text        string
			Type        string
			Order       float64
			Required    bool
			Description string
			Options     []string
		}{
			{
				Text:        "How would you rate your overall experience?",
				Type:        "select",
				Order:       1,
				Required:    true,
				Description: "Please rate your experience from 1 to 5",
				Options:     []string{"1 - Poor", "2 - Fair", "3 - Good", "4 - Very Good", "5 - Excellent"},
			},
			{
				Text:     "Would you recommend our clinic to others?",
				Type:     "select",
				Order:    2,
				Required: true,
				Options:  []string{"Yes", "No", "Maybe"},
			},
			{
				Text:        "What could we improve?",
				Type:        "text",
				Order:       3,
				Required:    false,
				Description: "Please share any suggestions for improvement",
			},
		}

		for _, q := range satisfactionQuestions {
			question := models.NewRecord(questions)
			question.Set("question_text", q.Text)
			question.Set("input_type", q.Type)
			question.Set("category", surveyCategory.Id)
			question.Set("order", q.Order)
			question.Set("required", q.Required)
			question.Set("description", q.Description)
			question.Set("archived", false)
			if len(q.Options) > 0 {
				question.Set("options", q.Options)
			}
			if err := dao.SaveRecord(question); err != nil {
				return err
			}
		}

		// Treatment Feedback Questions
		treatmentQuestions := []struct {
			Text        string
			Type        string
			Order       float64
			Required    bool
			Description string
			Options     []string
			DependsOn   string
		}{
			{
				Text:     "Did the provider explain your treatment clearly?",
				Type:     "select",
				Order:    1,
				Required: true,
				Options:  []string{"Yes, very clearly", "Somewhat clearly", "No, not clearly"},
			},
			{
				Text:     "Do you have any questions about your medications?",
				Type:     "checkbox",
				Order:    2,
				Required: true,
			},
			{
				Text:        "What questions do you have?",
				Type:        "text",
				Order:       3,
				Required:    false,
				Description: "Please list your questions about medications",
			},
		}

		// Map to store question IDs for dependency linking
		questionIds := make(map[string]string)

		for _, q := range treatmentQuestions {
			question := models.NewRecord(questions)
			question.Set("question_text", q.Text)
			question.Set("input_type", q.Type)
			question.Set("category", treatmentCategory.Id)
			question.Set("order", q.Order)
			question.Set("required", q.Required)
			question.Set("description", q.Description)
			question.Set("archived", false)
			if len(q.Options) > 0 {
				question.Set("options", q.Options)
			}
			if err := dao.SaveRecord(question); err != nil {
				return err
			}
			questionIds[q.Text] = question.Id
		}

		// Set up dependency for treatment questions
		if medicationQuestionId, ok := questionIds["Do you have any questions about your medications?"]; ok {
			followUpQuestion, err := dao.FindFirstRecordByData("encounter_questions", "question_text", "What questions do you have?")
			if err == nil {
				followUpQuestion.Set("depends_on", medicationQuestionId)
				if err := dao.SaveRecord(followUpQuestion); err != nil {
					return err
				}
			}
		}

		// Medication Experience Questions
		medicationQuestions := []struct {
			Text        string
			Type        string
			Order       float64
			Required    bool
			Description string
			Options     []string
			DependsOn   string
		}{
			{
				Text:     "Have you had any previous reactions to medications?",
				Type:     "checkbox",
				Order:    1,
				Required: true,
			},
			{
				Text:     "Please describe any previous reactions:",
				Type:     "text",
				Order:    2,
				Required: false,
			},
			{
				Text:     "How do you prefer to receive medication instructions?",
				Type:     "select",
				Order:    3,
				Required: true,
				Options:  []string{"Written", "Verbal", "Both"},
			},
		}

		// Clear the questionIds map for medication questions
		questionIds = make(map[string]string)

		for _, q := range medicationQuestions {
			question := models.NewRecord(questions)
			question.Set("question_text", q.Text)
			question.Set("input_type", q.Type)
			question.Set("category", medicationCategory.Id)
			question.Set("order", q.Order)
			question.Set("required", q.Required)
			question.Set("description", q.Description)
			question.Set("archived", false)
			if len(q.Options) > 0 {
				question.Set("options", q.Options)
			}
			if err := dao.SaveRecord(question); err != nil {
				return err
			}
			questionIds[q.Text] = question.Id
		}

		// Set up dependency for medication questions
		if reactionQuestionId, ok := questionIds["Have you had any previous reactions to medications?"]; ok {
			followUpQuestion, err := dao.FindFirstRecordByData("encounter_questions", "question_text", "Please describe any previous reactions:")
			if err == nil {
				followUpQuestion.Set("depends_on", reactionQuestionId)
				if err := dao.SaveRecord(followUpQuestion); err != nil {
					return err
				}
			}
		}

		// Seed inventory data
		inventoryItems := []struct {
			DrugName     string
			DrugCategory string
			Stock        float64
			FixedQty     float64
			UnitSize     string
			Dose         string
		}{
			{
				DrugName:     "Triamcinolone 0.1% (15g)",
				DrugCategory: "Dermatological / Steroid",
				Stock:        29,
				FixedQty:     1,
				UnitSize:     "1 tube",
				Dose:         "0.1%",
			},
			{
				DrugName:     "Triamcinolone 0.1% (30g)",
				DrugCategory: "Dermatological / Steroid",
				Stock:        20,
				FixedQty:     1,
				UnitSize:     "1 tube",
				Dose:         "0.1%",
			},
			{
				DrugName:     "Hydrocortisone Cream 1% (28g)",
				DrugCategory: "Dermatological / Steroid",
				Stock:        15,
				FixedQty:     1,
				UnitSize:     "1 tube",
				Dose:         "1%",
			},
			{
				DrugName:     "Children's Cetirizine (4 fl oz, 1mg/mL)",
				DrugCategory: "Allergy / Pediatric",
				Stock:        30,
				FixedQty:     1,
				UnitSize:     "1 bottle",
				Dose:         "1mg/mL",
			},
			{
				DrugName:     "Children's Acetaminophen (4 fl oz, 160mg/5mL)",
				DrugCategory: "Analgesic / Pediatric",
				Stock:        15,
				FixedQty:     1,
				UnitSize:     "1 bottle",
				Dose:         "160mg/5mL",
			},
			{
				DrugName:     "Mupirocin Ointment 2% (22g)",
				DrugCategory: "Antibiotic / Dermatological",
				Stock:        20,
				FixedQty:     1,
				UnitSize:     "1 tube",
				Dose:         "2%",
			},
			{
				DrugName:     "Robafen DM (4 fl oz)",
				DrugCategory: "Cough / Cold",
				Stock:        75,
				FixedQty:     1,
				UnitSize:     "1 bottle",
				Dose:         "Guaifenesin+Dextromethorphan",
			},
			{
				DrugName:     "Salbucort 100mcg",
				DrugCategory: "Respiratory / Steroid",
				Stock:        18,
				FixedQty:     1,
				UnitSize:     "1 inhaler",
				Dose:         "100mcg",
			},
			{
				DrugName:     "Children's Ibuprofen (100mg/5mL, 118mL)",
				DrugCategory: "Analgesic / Pediatric",
				Stock:        25,
				FixedQty:     1,
				UnitSize:     "1 bottle",
				Dose:         "100mg/5mL",
			},
			{
				DrugName:     "White Petrolatum (5g packets)",
				DrugCategory: "Dermatological / Emollient",
				Stock:        228,
				FixedQty:     1,
				UnitSize:     "1 packet",
				Dose:         "",
			},
			{
				DrugName:     "Ibuprofen Suspension (100mg/5mL, 120mL box)",
				DrugCategory: "Analgesic / Pediatric",
				Stock:        5,
				FixedQty:     1,
				UnitSize:     "1 box",
				Dose:         "100mg/5mL",
			},
			{
				DrugName:     "Guaifenesin 100mg (473mL bottle)",
				DrugCategory: "Cough / Expectorant",
				Stock:        5,
				FixedQty:     1,
				UnitSize:     "1 bottle",
				Dose:         "100mg per 5mL",
			},
			{
				DrugName:     "Clonidine 0.1mg",
				DrugCategory: "Blood Pressure",
				Stock:        100,
				FixedQty:     30,
				UnitSize:     "30 ct",
				Dose:         "0.1mg",
			},
			{
				DrugName:     "Bisacodyl 5mg",
				DrugCategory: "GI / Laxative",
				Stock:        1000,
				FixedQty:     10,
				UnitSize:     "10 ct",
				Dose:         "5mg",
			},
			{
				DrugName:     "Valacyclovir 500mg",
				DrugCategory: "Antiviral / Herpes",
				Stock:        90,
				FixedQty:     14,
				UnitSize:     "14 ct",
				Dose:         "500mg",
			},
			{
				DrugName:     "Prenatal Vitamins",
				DrugCategory: "Vitamin / Pregnancy",
				Stock:        1500,
				FixedQty:     30,
				UnitSize:     "30 ct",
				Dose:         "Folic Acid + Others",
			},
			{
				DrugName:     "Amlodipine 10mg",
				DrugCategory: "Blood Pressure / Calcium Channel Blocker",
				Stock:        3000,
				FixedQty:     30,
				UnitSize:     "30 ct",
				Dose:         "10mg",
			},
			{
				DrugName:     "Ibuprofen 200mg",
				DrugCategory: "Analgesic / NSAID",
				Stock:        5000,
				FixedQty:     30,
				UnitSize:     "30 ct",
				Dose:         "200mg",
			},
			{
				DrugName:     "Ibuprofen 400mg",
				DrugCategory: "Analgesic / NSAID",
				Stock:        1000,
				FixedQty:     30,
				UnitSize:     "30 ct",
				Dose:         "400mg",
			},
			{
				DrugName:     "Ibuprofen 600mg",
				DrugCategory: "Analgesic / NSAID",
				Stock:        1000,
				FixedQty:     30,
				UnitSize:     "30 ct",
				Dose:         "600mg",
			},
			{
				DrugName:     "Cetirizine 10mg",
				DrugCategory: "Allergy",
				Stock:        1200,
				FixedQty:     10,
				UnitSize:     "10 ct",
				Dose:         "10mg",
			},
			{
				DrugName:     "Famotidine 10mg",
				DrugCategory: "GI / Antacid",
				Stock:        3000,
				FixedQty:     14,
				UnitSize:     "14 ct",
				Dose:         "10mg",
			},
			{
				DrugName:     "Prednisone 5mg",
				DrugCategory: "Steroid",
				Stock:        100,
				FixedQty:     14,
				UnitSize:     "14 ct",
				Dose:         "5mg",
			},
			{
				DrugName:     "Prednisone 10mg",
				DrugCategory: "Steroid",
				Stock:        1000,
				FixedQty:     14,
				UnitSize:     "14 ct",
				Dose:         "10mg",
			},
			{
				DrugName:     "Hydrochlorothiazide 12.5mg",
				DrugCategory: "Blood Pressure / Diuretic",
				Stock:        1000,
				FixedQty:     30,
				UnitSize:     "30 ct",
				Dose:         "12.5mg",
			},
			{
				DrugName:     "Dexamethasone 4mg",
				DrugCategory: "Steroid",
				Stock:        1000,
				FixedQty:     14,
				UnitSize:     "14 ct",
				Dose:         "4mg",
			},
			{
				DrugName:     "Losartan 50mg",
				DrugCategory: "Blood Pressure / ARB",
				Stock:        2000,
				FixedQty:     30,
				UnitSize:     "30 ct",
				Dose:         "50mg",
			},
			{
				DrugName:     "Lisinopril 20mg",
				DrugCategory: "Blood Pressure / ACE Inhibitor",
				Stock:        1000,
				FixedQty:     30,
				UnitSize:     "30 ct",
				Dose:         "20mg",
			},
			{
				DrugName:     "Albendazole",
				DrugCategory: "Antiparasitic",
				Stock:        1000,
				FixedQty:     2,
				UnitSize:     "2 ct",
				Dose:         "",
			},
			{
				DrugName:     "Acetaminophen 90mg",
				DrugCategory: "Analgesic / Antipyretic",
				Stock:        2000,
				FixedQty:     20,
				UnitSize:     "20 ct",
				Dose:         "90mg",
			},
			{
				DrugName:     "Acetaminophen 325mg",
				DrugCategory: "Analgesic / Antipyretic",
				Stock:        6000,
				FixedQty:     20,
				UnitSize:     "20 ct",
				Dose:         "325mg",
			},
			{
				DrugName:     "Metronidazole 250mg",
				DrugCategory: "Antibiotic / Antiprotozoal",
				Stock:        1000,
				FixedQty:     14,
				UnitSize:     "14 ct",
				Dose:         "250mg",
			},
			{
				DrugName:     "Clotrimazole 1% Cream (20g)",
				DrugCategory: "Antifungal / Dermatological",
				Stock:        48,
				FixedQty:     1,
				UnitSize:     "1 tube",
				Dose:         "1%",
			},
			{
				DrugName:     "Artificial Tears (15mL)",
				DrugCategory: "Ophthalmic",
				Stock:        100,
				FixedQty:     1,
				UnitSize:     "1 bottle",
				Dose:         "",
			},
			{
				DrugName:     "Aspirin 81mg",
				DrugCategory: "Cardiovascular / NSAID",
				Stock:        2000,
				FixedQty:     30,
				UnitSize:     "30 ct",
				Dose:         "81mg",
			},
			{
				DrugName:     "Calcium 600mg + Vitamin D 10mcg",
				DrugCategory: "Supplement / Vitamin",
				Stock:        120,
				FixedQty:     30,
				UnitSize:     "30 ct",
				Dose:         "600mg + 10mcg",
			},
			{
				DrugName:     "Amoxicillin 250mg",
				DrugCategory: "Antibiotic",
				Stock:        2000,
				FixedQty:     14,
				UnitSize:     "14 ct",
				Dose:         "250mg",
			},
			{
				DrugName:     "Amoxicillin 500mg",
				DrugCategory: "Antibiotic",
				Stock:        500,
				FixedQty:     14,
				UnitSize:     "14 ct",
				Dose:         "500mg",
			},
			{
				DrugName:     "Amoxicillin 875mg",
				DrugCategory: "Antibiotic",
				Stock:        200,
				FixedQty:     14,
				UnitSize:     "14 ct",
				Dose:         "875mg",
			},
			{
				DrugName:     "Children's Acetaminophen (4 fl oz, 160mg/5mL)",
				DrugCategory: "Analgesic / Pediatric",
				Stock:        35,
				FixedQty:     1,
				UnitSize:     "1 bottle",
				Dose:         "160mg/5mL",
			},
			{
				DrugName:     "Clotrimazole 1% Cream (45g)",
				DrugCategory: "Antifungal / Dermatological",
				Stock:        15,
				FixedQty:     1,
				UnitSize:     "1 tube",
				Dose:         "1%",
			},
			{
				DrugName:     "Fluticasone 50mcg (16g)",
				DrugCategory: "Respiratory / Steroid",
				Stock:        25,
				FixedQty:     1,
				UnitSize:     "1 bottle",
				Dose:         "50mcg",
			},
			{
				DrugName:     "Ofloxacin 0.3% (5mL)",
				DrugCategory: "Antibiotic / Ophthalmic",
				Stock:        20,
				FixedQty:     1,
				UnitSize:     "1 bottle",
				Dose:         "0.3%",
			},
			{
				DrugName:     "Permethrin 5% (60g)",
				DrugCategory: "Scabicide / Pediculicide",
				Stock:        16,
				FixedQty:     1,
				UnitSize:     "1 tube",
				Dose:         "5%",
			},
			{
				DrugName:     "Silver Sulfadiazine Cream (50g)",
				DrugCategory: "Burn / Antibiotic",
				Stock:        3,
				FixedQty:     1,
				UnitSize:     "1 jar",
				Dose:         "1%",
			},
			{
				DrugName:     "Hydrocortisone Cream 1% (0.9g packets)",
				DrugCategory: "Dermatological / Steroid",
				Stock:        288,
				FixedQty:     1,
				UnitSize:     "1 packet",
				Dose:         "1%",
			},
			{
				DrugName:     "Zinc Oxide Ointment",
				DrugCategory: "Dermatological / Protectant",
				Stock:        5,
				FixedQty:     1,
				UnitSize:     "1 tube",
				Dose:         "",
			},
			{
				DrugName:     "Albuterol 0.083% (3mL)",
				DrugCategory: "Respiratory / Bronchodilator",
				Stock:        50,
				FixedQty:     1,
				UnitSize:     "1 vial",
				Dose:         "0.083%",
			},
			{
				DrugName:     "Ceftriaxone 500mg/vial",
				DrugCategory: "Antibiotic",
				Stock:        10,
				FixedQty:     1,
				UnitSize:     "1 vial",
				Dose:         "500mg",
			},
			{
				DrugName:     "Fluconazole 150mg",
				DrugCategory: "Antifungal",
				Stock:        500,
				FixedQty:     1,
				UnitSize:     "1 tab",
				Dose:         "150mg",
			},
			{
				DrugName:     "Ciprofloxacin 500mg",
				DrugCategory: "Antibiotic",
				Stock:        500,
				FixedQty:     14,
				UnitSize:     "14 ct",
				Dose:         "500mg",
			},
			{
				DrugName:     "Captopril 25mg",
				DrugCategory: "Blood Pressure / ACE Inhibitor",
				Stock:        2000,
				FixedQty:     30,
				UnitSize:     "30 ct",
				Dose:         "25mg",
			},
			{
				DrugName:     "Docusate 100mg",
				DrugCategory: "GI / Stool Softener",
				Stock:        200,
				FixedQty:     10,
				UnitSize:     "10 ct",
				Dose:         "100mg",
			},
			{
				DrugName:     "Metoprolol Tartrate 50mg",
				DrugCategory: "Blood Pressure / Beta Blocker",
				Stock:        1000,
				FixedQty:     30,
				UnitSize:     "30 ct",
				Dose:         "50mg",
			},
			{
				DrugName:     "Cyclobenzaprine 10mg",
				DrugCategory: "Muscle Relaxant",
				Stock:        200,
				FixedQty:     14,
				UnitSize:     "14 ct",
				Dose:         "10mg",
			},
			{
				DrugName:     "Cephalexin 500mg",
				DrugCategory: "Antibiotic",
				Stock:        500,
				FixedQty:     14,
				UnitSize:     "14 ct",
				Dose:         "500mg",
			},
			{
				DrugName:     "Amlodipine 5mg",
				DrugCategory: "Blood Pressure / Calcium Channel Blocker",
				Stock:        2000,
				FixedQty:     30,
				UnitSize:     "30 ct",
				Dose:         "5mg",
			},
			{
				DrugName:     "Terbinafine 250mg",
				DrugCategory: "Antifungal",
				Stock:        300,
				FixedQty:     14,
				UnitSize:     "14 ct",
				Dose:         "250mg",
			},
			{
				DrugName:     "Clindamycin 150mg",
				DrugCategory: "Antibiotic",
				Stock:        100,
				FixedQty:     14,
				UnitSize:     "14 ct",
				Dose:         "150mg",
			},
			{
				DrugName:     "Loperamide 2mg",
				DrugCategory: "GI / Antidiarrheal",
				Stock:        100,
				FixedQty:     10,
				UnitSize:     "10 ct",
				Dose:         "2mg",
			},
			{
				DrugName:     "Loperamide 2mg",
				DrugCategory: "GI / Antidiarrheal",
				Stock:        500,
				FixedQty:     10,
				UnitSize:     "10 ct",
				Dose:         "2mg",
			},
			{
				DrugName:     "Candesartan 16mg",
				DrugCategory: "Blood Pressure / ARB",
				Stock:        90,
				FixedQty:     30,
				UnitSize:     "30 ct",
				Dose:         "16mg",
			},
			{
				DrugName:     "Clopidogrel 75mg",
				DrugCategory: "Cardiovascular / Antiplatelet",
				Stock:        90,
				FixedQty:     30,
				UnitSize:     "30 ct",
				Dose:         "75mg",
			},
			{
				DrugName:     "Celecoxib 200mg",
				DrugCategory: "Analgesic / NSAID",
				Stock:        100,
				FixedQty:     10,
				UnitSize:     "10 ct",
				Dose:         "200mg",
			},
			{
				DrugName:     "Atorvastatin 40mg",
				DrugCategory: "Cardiovascular / Cholesterol",
				Stock:        90,
				FixedQty:     30,
				UnitSize:     "30 ct",
				Dose:         "40mg",
			},
			{
				DrugName:     "Atorvastatin 20mg",
				DrugCategory: "Cardiovascular / Cholesterol",
				Stock:        90,
				FixedQty:     30,
				UnitSize:     "30 ct",
				Dose:         "20mg",
			},
			{
				DrugName:     "Ibandronate 150mg",
				DrugCategory: "Bone Health / Bisphosphonate",
				Stock:        3,
				FixedQty:     1,
				UnitSize:     "1 ct",
				Dose:         "150mg",
			},
			{
				DrugName:     "Adult Multivitamin",
				DrugCategory: "Vitamin / Supplement",
				Stock:        78000,
				FixedQty:     30,
				UnitSize:     "30 ct",
				Dose:         "",
			},
			{
				DrugName:     "Children's Chewable Multivitamin",
				DrugCategory: "Vitamin / Pediatric",
				Stock:        15000,
				FixedQty:     30,
				UnitSize:     "30 ct",
				Dose:         "",
			},
			{
				DrugName:     "Lactulose Solution USP 10g/15mL (16oz)",
				DrugCategory: "GI / Laxative",
				Stock:        20,
				FixedQty:     1,
				UnitSize:     "1 bottle",
				Dose:         "10g/15mL",
			},
			{
				DrugName:     "Levalbuterol 0.021% (0.63mg) Nebs",
				DrugCategory: "Respiratory / Bronchodilator",
				Stock:        93,
				FixedQty:     1,
				UnitSize:     "1 nebulizer vial",
				Dose:         "0.63mg/3mL",
			},
			{
				DrugName:     "Carboxymethylcellulose Sodium 0.5% (0.01 fl oz)",
				DrugCategory: "Ophthalmic / Lubricant",
				Stock:        90,
				FixedQty:     1,
				UnitSize:     "1 bottle",
				Dose:         "0.5%",
			},
			{
				DrugName:     "Ketorolac Tromethamine 0.5% (5mL)",
				DrugCategory: "Ophthalmic / NSAID",
				Stock:        10,
				FixedQty:     1,
				UnitSize:     "1 bottle",
				Dose:         "0.5%",
			},
			{
				DrugName:     "Heparin Lock Flush Solution (100 units/mL)",
				DrugCategory: "Anticoagulant",
				Stock:        30,
				FixedQty:     1,
				UnitSize:     "1 flush",
				Dose:         "100 units/mL",
			},
			{
				DrugName:     "Cephalexin 250mg",
				DrugCategory: "Antibiotic",
				Stock:        200,
				FixedQty:     14,
				UnitSize:     "14 ct",
				Dose:         "250mg",
			},
			{
				DrugName:     "Fluticasone Propionate Nasal Spray 50mcg",
				DrugCategory: "Respiratory / Steroid",
				Stock:        1,
				FixedQty:     1,
				UnitSize:     "1 bottle",
				Dose:         "50mcg",
			},
			{
				DrugName:     "Ear Drops (Carbamide Peroxide 6.5%, 0.5 fl oz)",
				DrugCategory: "Otic",
				Stock:        3,
				FixedQty:     1,
				UnitSize:     "1 bottle",
				Dose:         "6.5%",
			},
			{
				DrugName:     "Meloxicam 7.5mg",
				DrugCategory: "Analgesic / NSAID",
				Stock:        200,
				FixedQty:     14,
				UnitSize:     "14 ct",
				Dose:         "7.5mg",
			},
			{
				DrugName:     "Furosemide (2mL)",
				DrugCategory: "Diuretic / Blood Pressure",
				Stock:        10,
				FixedQty:     1,
				UnitSize:     "1 vial",
				Dose:         "10mg/mL (approx.)",
			},
			{
				DrugName:     "Gentamicin 0.3%",
				DrugCategory: "Antibiotic / Ophthalmic",
				Stock:        20,
				FixedQty:     1,
				UnitSize:     "1 bottle",
				Dose:         "0.3%",
			},
			{
				DrugName:     "Sterile Water Solution (10mL)",
				DrugCategory: "Irrigation / Diluent",
				Stock:        60,
				FixedQty:     1,
				UnitSize:     "1 vial",
				Dose:         "10 mL",
			},
			{
				DrugName:     "Guaifenesin 400mg (100)",
				DrugCategory: "Cough / Expectorant",
				Stock:        300,
				FixedQty:     10,
				UnitSize:     "10 ct",
				Dose:         "400mg",
			},
			{
				DrugName:     "Rifaximin 550mg (60)",
				DrugCategory: "Antibiotic / GI",
				Stock:        120,
				FixedQty:     14,
				UnitSize:     "14 ct",
				Dose:         "550mg",
			},
			{
				DrugName:     "Ciprofloxacin Ophthalmic Solution (5mL)",
				DrugCategory: "Antibiotic / Ophthalmic",
				Stock:        2,
				FixedQty:     1,
				UnitSize:     "1 bottle",
				Dose:         "0.3%",
			},
			{
				DrugName:     "Dexamethasone Injection (100mg/10mL)",
				DrugCategory: "Steroid / Injection",
				Stock:        1,
				FixedQty:     1,
				UnitSize:     "1 vial",
				Dose:         "100mg/10mL",
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

		// Seed survey questions
		if err := seedQuestions(dao, surveyCategory.Id, []SeedQuestion{
			{
				QuestionText: "How would you rate your overall experience?",
				InputType:    "select",
				Description:  "Please rate your overall experience with our clinic",
				Options:      []string{"Excellent", "Good", "Fair", "Poor"},
				Order:        1,
				Required:     false,
			},
			{
				QuestionText: "Would you recommend our clinic to others?",
				InputType:    "select",
				Description:  "Would you recommend our services to friends or family?",
				Options:      []string{"Yes, definitely", "Maybe", "No"},
				Order:        2,
				Required:     false,
			},
			{
				QuestionText: "What could we improve?",
				InputType:    "text",
				Description:  "Please share any suggestions for improvement",
				Order:        3,
				Required:     false,
			},
		}); err != nil {
			return err
		}

		// Seed diagnosis data
		diagnoses := []string{
			"HYPERTENSION", "HYPERLIPIDEMIA", "TYPE 2 DIABETES MELLITUS", "OBESITY", "HYPOTHYROIDISM",
			"ACUTE UPPER RESPIRATORY INFECTION", "URINARY TRACT INFECTION", "ACUTE SINUSITIS",
			"SEASONAL ALLERGIES (ALLERGIC RHINITIS)", "VITAMIN D DEFICIENCY",
			"MYOCARDIAL INFARCTION (STEMI/NSTEMI)", "CONGESTIVE HEART FAILURE", "ATRIAL FIBRILLATION",
			"HYPERTENSIVE EMERGENCY", "STABLE ANGINA", "PERIPHERAL ARTERIAL DISEASE", "PERICARDITIS",
			"ENDOCARDITIS", "MITRAL VALVE PROLAPSE", "CARDIOMYOPATHY", "ASTHMA",
			"CHRONIC OBSTRUCTIVE PULMONARY DISEASE (COPD)", "PULMONARY EMBOLISM", "PNEUMONIA",
			"BRONCHITIS", "OBSTRUCTIVE SLEEP APNEA", "ACUTE RESPIRATORY DISTRESS SYNDROME (ARDS)",
			"TUBERCULOSIS", "LUNG CANCER", "CYSTIC FIBROSIS",
			"GASTROESOPHAGEAL REFLUX DISEASE (GERD)", "PEPTIC ULCER DISEASE",
			"IRRITABLE BOWEL SYNDROME (IBS)", "DIVERTICULITIS",
			"INFLAMMATORY BOWEL DISEASE (CROHN'S/ULCERATIVE COLITIS)", "CHOLECYSTITIS", "HEPATITIS C",
			"LIVER CIRRHOSIS", "PANCREATITIS", "APPENDICITIS", "INFLUENZA", "COVID-19", "SEPSIS",
			"CELLULITIS", "OSTEOMYELITIS", "HIV/AIDS", "BACTERIAL MENINGITIS",
			"HERPES ZOSTER (SHINGLES)", "SEXUALLY TRANSMITTED INFECTIONS (CHLAMYDIA/GONORRHEA)",
			"MALARIA", "RHEUMATOID ARTHRITIS", "SYSTEMIC LUPUS ERYTHEMATOSUS", "GOUT",
			"ANKYLOSING SPONDYLITIS", "SJÖGREN'S SYNDROME", "SCLERODERMA", "VASCULITIS",
			"POLYMYALGIA RHEUMATICA", "FIBROMYALGIA", "PSORIATIC ARTHRITIS",
			"STROKE (ISCHEMIC AND HEMORRHAGIC)", "TRANSIENT ISCHEMIC ATTACK", "MIGRAINE",
			"TENSION HEADACHE", "PARKINSON'S DISEASE", "ALZHEIMER'S DISEASE", "MULTIPLE SCLEROSIS",
			"SEIZURE DISORDER (EPILEPSY)", "BELL'S PALSY", "GUILLAIN-BARRÉ SYNDROME",
			"MAJOR DEPRESSIVE DISORDER", "GENERALIZED ANXIETY DISORDER", "BIPOLAR DISORDER",
			"POST-TRAUMATIC STRESS DISORDER (PTSD)", "SCHIZOPHRENIA", "OBSESSIVE-COMPULSIVE DISORDER",
			"SUBSTANCE USE DISORDER (ALCOHOL/OPIOIDS)", "ADHD", "INSOMNIA", "ADJUSTMENT DISORDER",
			"TYPE 1 DIABETES MELLITUS", "HYPERTHYROIDISM", "POLYCYSTIC OVARY SYNDROME (PCOS)",
			"ADRENAL INSUFFICIENCY (ADDISON'S DISEASE)", "CUSHING'S SYNDROME", "HYPERPARATHYROIDISM",
			"HYPOPARATHYROIDISM", "OSTEOPOROSIS", "PITUITARY TUMOR (PROLACTINOMA)",
			"DIABETES INSIPIDUS", "IRON-DEFICIENCY ANEMIA", "SICKLE CELL DISEASE",
			"DEEP VEIN THROMBOSIS (DVT)", "LEUKEMIA (E.G., ACUTE LYMPHOBLASTIC LEUKEMIA)",
			"LYMPHOMA (HODGKIN'S/NON-HODGKIN'S)", "BREAST CANCER", "COLON CANCER", "PROSTATE CANCER",
			"THROMBOCYTOPENIA", "HEMOPHILIA",
		}

		for _, diagnosisName := range diagnoses {
			record := models.NewRecord(diagnosis)
			record.Set("name", diagnosisName)
			if err := dao.SaveRecord(record); err != nil {
				return err
			}
		}

		return nil
	}, func(db dbx.Builder) error {
		// Revert changes
		dao := daos.New(db)

		collections := []string{
			"inventory", "patients", "encounters", "disbursements",
			"chief_complaints", "encounter_question_categories",
			"encounter_questions", "encounter_responses",
			"bulk_distributions", "bulk_distribution_items", "queue",
		}

		for _, name := range collections {
			collection, err := dao.FindCollectionByNameOrId(name)
			if err != nil {
				continue
			}
			if err := dao.DeleteCollection(collection); err != nil {
				return err
			}
		}

		return nil
	})
}
