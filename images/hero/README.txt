HERO IMAGES — HOW TO ADD YOUR PHOTOS
=====================================

1. Save your 5 hero photos into this folder (images/hero/)
   Recommended file names:
     hero-1.jpg
     hero-2.jpg
     hero-3.jpg
     hero-4.jpg
     hero-5.jpg

2. Open index.html in a text editor (or ask Claude to do it for you)

3. Find each slide block that looks like this:
     <div class="slide-placeholder" ...>Add image: images/hero/hero-1.jpg</div>

   Replace it with:
     <img src="images/hero/hero-1.jpg" alt="Brief description of the photo">

PHOTO TIPS
----------
- Landscape orientation works best (wider than tall)
- 3840px wide. See "WHY 3840" below — 1600px is not enough any more.
- JPG format is fine; up to about 1.5MB each is fine at that size
- Great hero subjects: exteriors, dramatic interior moments, landscape/site shots

WHY 3840
--------
The hero fills the whole window. On a 4K monitor that box is 3840 x 1987,
and on a Retina laptop the screen asks for about 3024 across. Every file
currently in the slideshow is between 1440 and 1800px wide, so the browser
has to stretch it 1.7x to 2.7x, and stretching is what "soft" looks like.

  red-coat-hill-04.jpg   1800px   2.13x at 4K
  hero-14.jpg            1800px   2.13x at 4K
  runner-road-hero.jpg   1584px   2.42x at 4K
  hero-5.jpg             1440px   2.67x at 4K

There is no way to fix this from the files in the repository. Enlarging
them adds no detail — it makes a bigger soft picture and a slower page.
The only fix is the original frames from the photographers, re-exported at
3840px. Checked, and not available anywhere reachable: not in this repo's
history, not in the shared Dropbox, not on the live site (which serves the
same sizes), and auerbachottinger.com no longer answers.

So these four need re-exporting from
  C:\Dropbox\03_OPERATIONS, MKTING, BD\MARKETING\PROJECT IMAGES\
or from whoever holds the originals. Anything at or above 3840px wide is
enough; Claude will cut them to size.

PROJECT IMAGES (images/projects/)
----------------------------------
Name your files like:  pond-house-01.jpg, pond-house-02.jpg, tisbury-01.jpg, etc.
Then ask Claude: "Add the photo pond-house-01.jpg to the Pond House project page"

TEAM PHOTOS (images/team/)
---------------------------
Name your files:  zander.jpg  and  emily.jpg
Then ask Claude: "Add the team portraits to the About page"
