import Sefaria from "./sefaria/sefaria";
import {InterfaceText, TopicPictureUploader} from "./Misc";
import $ from "./sefaria/sefariaJquery";
import {AdminEditor} from "./AdminEditor";
import {Reorder} from "./CategoryEditor";
import {ImageCropper} from "./ImageCropper";
import React, {useState, useEffect} from "react";


const TopicPictureCropper = ({}) => {
    return (<div>hello</div>);
}


const TopicEditor = ({origData, onCreateSuccess, close, origWasCat}) => {
    const [data, setData] = useState({...origData, catSlug: origData.origCatSlug || "",
                                enTitle: origData.origEnTitle, heTitle: origData.origHeTitle || "",
                                heDescription: origData?.origHeDescription || "",
                                enDescription: origData?.origEnDescription || "",
                                enCategoryDescription: origData?.origEnCategoryDescription || "",
                                heCategoryDescription: origData?.origHeCategoryDescription || "",
                                enAltTitles: origData?.origEnAltTitles || [],
                                heAltTitles: origData?.origHeAltTitles || [],
                                birthPlace: origData.origBirthPlace || "", heBirthPlace: origData.origHeBirthPlace || "",
                                birthYear: origData.origBirthYear || "", heDeathPlace: origData.origHeDeathPlace || "",
                                deathYear: origData.origDeathYear || "", era: origData.origEra || "",
                                deathPlace: origData.origDeathPlace || "",
                                enImgCaption: origData?.origImage?.image_caption?.en || "",
                                heImgCaption: origData?.origImage?.image_caption?.he || "",
                                image_uri: origData?.origImage?.image_uri || ""
                                });
    const isNew = !('origSlug' in origData);
    const [savingStatus, setSavingStatus] = useState(false);
    const [isAuthor, setIsAuthor] = useState(origData.origCatSlug === 'authors');
    const [isCategory, setIsCategory] = useState(origWasCat);  // initialize to True if the topic originally was a category
                                                                  // isCategory determines whether user can edit categoryDescriptions of topic
    const subtopics = Sefaria.topicTocPage(origData.origSlug);
    const [sortedSubtopics, setSortedSubtopics] = useState(subtopics?.sort(Sefaria.sortTopicsCompareFn)
                                                                                .filter(x => x.slug !== origData.origSlug) // dont include topics that are self-linked
                                                                                || []);
    const [isChanged, setIsChanged] = useState(false);
    const [changedPicture, setChangedPicture] = useState(false);

    const disambiguationExtractionRegex = /\((.+)\)$/;

    const toggle = function() {
      setSavingStatus(savingStatus => !savingStatus);
    }

    const closeTopicEditor = (e) => {
        if (changedPicture) {
            alert("You changed the topic picture, and therefore, you must save your topic changes.");
            return;
        }
        close(e);
    }


    const handleCatChange = function(e) {
      data.catSlug = e.target.value;
      //logic is: if it starts out originally a category, isCategory should always be true, otherwise, it should depend solely on 'Main Menu'
      const newIsCategory = origWasCat || e.target.value === Sefaria._("Main Menu");
      setIsCategory(newIsCategory);
      setIsChanged(true);
      setIsAuthor(data.catSlug === 'authors');
      setData({...data});
    }

    let slugsToTitles = Sefaria.slugsToTitles();
    let specialCases = {
        "": {"en": "Choose a Parent Topic", "he": Sefaria.translation('he', "Choose a Parent Topic")},
        "Main Menu": {"en": "Main Menu", "he": Sefaria.translation('he', "Main Menu")}
    };
    slugsToTitles = Object.assign(specialCases, slugsToTitles);
    const catMenu =   <div className="section">
                                            <label><InterfaceText>Parent Topic</InterfaceText></label>
                                            <div className="categoryChooserMenu">
                                                <select key="topicCats" id="topicCats" onChange={handleCatChange}>
                                                    {Object.keys(slugsToTitles).map(function (tempSlug, i) {
                                                        const tempTitle = Sefaria.interfaceLang === 'english' ? slugsToTitles[tempSlug].en : slugsToTitles[tempSlug].he;
                                                        return <option key={i} value={tempSlug} selected={data.catSlug === tempSlug}>{tempTitle}</option>;
                                                    })}
                                                </select>
                                            </div>
                                    </div>;

    const updateData = function(newData) {
        setIsChanged(true);
        setData(newData);
    }
    const validate = async function () {
        if (!isChanged) {
            alert("You haven't changed any of the fields.");
            return false;
        }
        if (data.catSlug === "") {
          alert(Sefaria._("Please choose a category."));
          return false;
        }
        if (data.enTitle.length === 0) {
          alert(Sefaria._("Title must be provided."));
          return false;
        }
        if (data.enImgCaption.length > 300) {
            alert("English caption is too long.  It should not be more than 300 characters");
            return false;
        }
        if (data.heImgCaption.length > 300) {
            alert("Hebrew caption is too long.  It should not be more than 300 characters")
            return false;
        }
        if (sortedSubtopics.length > 0 && !isNew) {
            await saveReorderedSubtopics();  // make sure subtopics reordered before saving topic information below
        }
        saveTopic();
    }
    const saveReorderedSubtopics = function () {
         const url = `/api/topic/reorder`;
         const postCategoryData = {topics: sortedSubtopics};
         Sefaria.adminEditorApiRequest(url, null, postCategoryData)
             .then(() => window.location.href = "/topics")
             .finally(() => setSavingStatus(false));
    }

    const extractDisambiguationFromTitle = function(titleText){
        return titleText.match(disambiguationExtractionRegex)?.[1];
    }
    const removeDisambiguationFromTitle = function(titleText){
        return titleText.replace(disambiguationExtractionRegex, "").trimEnd();
    }

    const createPrimaryTitleObj = function(rawTitle, lang){
        let primaryTitleObj = {'text': removeDisambiguationFromTitle(rawTitle), "lang": lang, "primary": true};
        let disambiguation = extractDisambiguationFromTitle(rawTitle);
        if (disambiguation) {primaryTitleObj["disambiguation"]=disambiguation};
        return primaryTitleObj;
    };
    const createNonPrimaryTitleObjArray = function(altTitles, lang){
        const titleObjArray = []
        altTitles.forEach((title) => {
            let titleObj = {'text': removeDisambiguationFromTitle(title), "lang": lang};
            let disambiguation = extractDisambiguationFromTitle(title);
            if (disambiguation) {titleObj["disambiguation"]=disambiguation}
            titleObjArray.push(titleObj)
        });
        return titleObjArray
    };

    const prepData = () => {
        // always add category, title, heTitle, altTitles
        let postData = { category: data.catSlug, titles: []};

        //convert title and altTitles to the database format, including extraction of disambiguation from title string
        postData['titles'].push(createPrimaryTitleObj(data.enTitle, 'en'));
        postData['titles'].push(createPrimaryTitleObj(data.heTitle, 'he'));
        postData['titles'] = postData['titles'].concat(createNonPrimaryTitleObjArray(data.enAltTitles.map(x => x.name), 'en'));
        postData['titles'] = postData['titles'].concat(createNonPrimaryTitleObjArray(data.heAltTitles.map(x => x.name), 'he'));

        // add image if image or caption changed
        const origImageURI = origData?.origImage?.image_uri || "";
        const origEnCaption = origData?.origImage?.image_caption?.en || "";
        const origHeCaption = origData?.origImage?.image_caption?.he || "";
        if (data.image_uri !== origImageURI || data.enImgCaption !== origEnCaption || data.heImgCaption !== origHeCaption) {
            postData.image = {"image_uri": data.image_uri, "image_caption": {"en": data.enImgCaption, "he": data.heImgCaption}}
        }

        // add descriptions if they changed
        const origDescription = {en: origData?.origEnDescription || "", he: origData?.origHeDescription || ""};
        const origCategoryDescription = {en: origData?.origEnCategoryDescription || "", he: origData?.origHeCategoryDescription || ""};
        const descriptionChanged = data.enDescription !== origDescription.en || data.heDescription !== origDescription.he;
        if (descriptionChanged) {
            postData.description = {en: data.enDescription, he: data.heDescription};
        }
        const categoryDescriptionChanged = data.enCategoryDescription !== origCategoryDescription.en || data.heCategoryDescription !== origCategoryDescription.he
        if (isCategory && categoryDescriptionChanged) {
            postData.categoryDescription = {en: data.enCategoryDescription, he: data.heCategoryDescription};
        }

        // add author keys if they changed
        if (isAuthor) {
            let authorKeys = ['era', 'birthPlace', 'heBirthPlace', 'birthYear', 'deathYear', 'deathPlace', 'heDeathPlace'];
            authorKeys.map(k => {
                const firstLetter = k.charAt(0).toUpperCase();
                const origKey = `orig${firstLetter}${k.slice(1)}`;
                const origVal = origData[origKey] || "";
                const newVal = data[k] || "";
                if (origVal !== newVal) {
                    postData[k] = data[k];
                }
            })
        }

        if (!isNew) {
          postData = {...postData, origSlug: data.origSlug, origCategory: data.origCatSlug};
        }

        return postData;
    }

    const saveTopic = function () {
        toggle();
        const postData = prepData();
        let postURL = isNew ? "/api/topic/new" : `/api/topics/${data.origSlug}`;
        const postJSON = JSON.stringify(postData);
        $.post(postURL, {"json": postJSON}, function (result) {
            if (result.error) {
                toggle();
                alert(result.error);
            } else {
                const newSlug = result.slug;
                if (onCreateSuccess) {
                    onCreateSuccess(newSlug);
                }
                else {
                    window.location.href = `/topics/${newSlug}`;
                }
            }
        }).fail(function (xhr, status, errorThrown) {
            alert("Unfortunately, there may have been an error saving this topic information: " + errorThrown.toString());
        });
    }
    const handlePictureChange = (url) => {
        data["image_uri"] = url;
        setChangedPicture(true);
        updateData({...data});
    }

    const deleteObj = function() {
        const url = `/api/topic/delete/${data.origSlug}`;
        Sefaria.adminEditorApiRequest(url, null, null, "DELETE").then(() => window.location.href = "/topics");
    }
    let items = ["Title", "Hebrew Title", "English Description", "Hebrew Description", "Category Menu", "English Alternate Titles", "Hebrew Alternate Titles",];
    if (isCategory) {
        items.push("English Short Description");
        items.push("Hebrew Short Description");
    }
    if (isAuthor) {
        const authorItems = ["Birth Place", "Hebrew Birth Place", "Birth Year", "Place of Death", "Hebrew Place of Death", "Death Year", "Era"];
        authorItems.forEach(x => items.push(x));
    }
    items.push("Picture Uploader");
    items.push("English Caption");
    items.push("Hebrew Caption");
    items.push("Secondary Picture Cropper")
    return <AdminEditor title="Topic Editor" close={closeTopicEditor} catMenu={catMenu} data={data} savingStatus={savingStatus}
                        validate={validate} deleteObj={deleteObj} updateData={updateData} isNew={isNew} items={items}
                        pictureUploader={<TopicPictureUploader slug={data.origSlug} callback={handlePictureChange} old_filename={data.image_uri}
                                                               caption={{en: data.enImgCaption, he: data.heImgCaption}}/>}
                        secondaryPictureCropper={<TopicPictureCropper />}
                        extras={
                              [isNew ? null :
                                <Reorder subcategoriesAndBooks={sortedSubtopics}
                                         updateOrder={setSortedSubtopics}
                                         displayType="topics"/>,
                            ]
                        } />;
}


export {TopicEditor};