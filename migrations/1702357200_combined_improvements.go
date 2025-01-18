package migrations

import (
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
					Required: true,
				},
				&schema.SchemaField{
					Name:     "dose",
					Type:     "text",
					Required: true,
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
				&schema.SchemaField{
					Name:     "height_inches",
					Type:     "number",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "weight",
					Type:     "number",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "temperature",
					Type:     "number",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "heart_rate",
					Type:     "number",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "systolic_pressure",
					Type:     "number",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "diastolic_pressure",
					Type:     "number",
					Required: false,
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
						MaxSelect:    types.Pointer(1),
					},
				},
				&schema.SchemaField{
					Name:     "other_chief_complaint",
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
					Required: false,
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

		// Save patients collection with its own rules
		if err := dao.SaveCollection(patients); err != nil {
			return err
		}

		// Set rules for other collections
		authRule := "@request.auth.id != ''"
		deleteRule := "@request.auth.role = 'provider' || @request.auth.role = 'admin'"

		collections := []*models.Collection{
			inventory, encounters, disbursements,
			chiefComplaints, questionCategories, questions,
			responses, bulkDistributions, bulkItems, queue,
		}

		for _, c := range collections {
			c.CreateRule = &authRule
			c.UpdateRule = &authRule
			c.DeleteRule = &deleteRule
			c.ListRule = &authRule
			c.ViewRule = &authRule

			if err := dao.SaveCollection(c); err != nil {
				return err
			}
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
